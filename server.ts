import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { validateExternalHttpUrl } from './src/utils/urlSafety';
import type { BrandContextPayload } from './src/types/studio';

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = 'gemini-4-hydrogen';

// Load public Firebase config for server-side ID token verification via Identity Toolkit
let firebaseWebApiKey = '';
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    firebaseWebApiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
  }
} catch {
  firebaseWebApiKey = '';
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Lightweight sliding-window rate limiter per IP for AI endpoints
const rateBuckets = new Map<string, number[]>();
// Avoid repeatedly burning quota/latency on Google Search grounding if current key tier returns 429
let googleSearchCooldownUntil = 0;
function checkRateLimit(ip: string, limit = 25, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= limit) {
    rateBuckets.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(ip, timestamps);
  return true;
}

interface VerifiedUser {
  uid: string;
  email: string;
}

async function verifyFirebaseBearerToken(authHeader?: string): Promise<VerifiedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 5000 || !firebaseWebApiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        firebaseWebApiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user.email) return null;
    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

function formatBrandContextPrompt(brand?: BrandContextPayload): string {
  if (!brand || !brand.name) {
    return 'No specific brand memory provided. Use a refined, authoritative social media agency voice.';
  }
  const memoryLines = (brand.memory || [])
    .slice(0, 20)
    .map(
      (item) =>
        `- [${item.category} | lang:${item.languageScope}] ${item.title}: ${item.detail}`
    )
    .join('\n');

  return [
    `CLIENT BRAND: ${brand.name}`,
    `INDUSTRY: ${brand.industry || 'General'}`,
    `PRIMARY MARKETS: ${brand.primaryMarkets || 'India & Global'}`,
    `BRAND SUMMARY: ${brand.brandSummary || ''}`,
    `BANNED TERMS (STRICTLY AVOID): ${brand.bannedTerms || 'None specified'}`,
    `DEFAULT LANGUAGES: ${(brand.defaultLanguages || ['en']).join(', ')}`,
    'BRAND VOICE & AUDIENCE MEMORY:',
    memoryLines || '- No memory items saved yet.',
  ].join('\n');
}

function safeJsonParse<T>(rawText: string | undefined, fallbackError: string): T {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!cleaned) {
    throw new Error(fallbackError);
  }
  return JSON.parse(cleaned) as T;
}

async function generateWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'sudershan-ai',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
    });
  });

  // Auth / rate-limit guard for AI Studio endpoints
  const aiGuard: express.RequestHandler = async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      return;
    }

    const authHeader = req.headers.authorization;
    const isDemoHeader = req.headers['x-sudershan-mode'] === 'demo';
    if (authHeader) {
      const verified = await verifyFirebaseBearerToken(authHeader);
      if (!verified) {
        res.status(401).json({ error: 'Invalid or expired authentication token.' });
        return;
      }
      next();
      return;
    }

    if (isDemoHeader) {
      next();
      return;
    }

    res.status(401).json({ error: 'Authentication required to access AI Studio endpoints.' });
  };

  // 1. AI Monthly Content Calendar Generator
  app.post('/api/ai/calendar', aiGuard, async (req, res) => {
    try {
      const { brand, monthLabel, objective, cadencePerWeek, focusPillars, languages } = req.body as {
        brand?: BrandContextPayload;
        monthLabel?: string;
        objective?: string;
        cadencePerWeek?: number;
        focusPillars?: string;
        languages?: string[];
      };

      if (!monthLabel?.trim() || !objective?.trim()) {
        res.status(400).json({ error: 'Month and campaign objective are required.' });
        return;
      }

      const cadence = Math.min(Math.max(Number(cadencePerWeek) || 4, 2), 7);
      const targetSlotCount = Math.min(cadence * 4, 24);
      const ai = getGenAIClient();

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            `Generate a structured monthly social media content calendar for ${monthLabel.trim()}.`,
            `Campaign Objective: ${objective.trim()}`,
            `Weekly Cadence: ${cadence} posts/week (${targetSlotCount} scheduled slots spread across the month).`,
            `Focus Pillars: ${focusPillars?.trim() || 'Use the brand memory pillars and balanced mix of education, proof, storytelling, and conversion.'}`,
            `Target Languages: ${(languages && languages.length ? languages : ['en', 'hi', 'gu']).join(', ')}`,
            'Ensure hooks are specific, culturally resonant, and never violate banned terms.',
          ].join('\n'),
          config: {
            systemInstruction: `You are the Senior Social Media Strategist at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                slots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dayOfMonth: { type: Type.INTEGER },
                      dateLabel: { type: Type.STRING },
                      format: { type: Type.STRING, enum: ['Reel', 'Carousel', 'Static', 'Story'] },
                      pillar: { type: Type.STRING },
                      topic: { type: Type.STRING },
                      hookIdea: { type: Type.STRING },
                      languages: { type: Type.ARRAY, items: { type: Type.STRING } },
                      ctaGoal: { type: Type.STRING },
                    },
                    required: [
                      'dayOfMonth',
                      'dateLabel',
                      'format',
                      'pillar',
                      'topic',
                      'hookIdea',
                      'languages',
                      'ctaGoal',
                    ],
                  },
                },
              },
              required: ['slots'],
            },
          },
        })
      );

      const parsed = safeJsonParse<{ slots: Array<Record<string, unknown>> }>(
        response.text,
        'Failed to parse calendar output.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Calendar AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate monthly calendar.',
      });
    }
  });

  // 2. Multilingual Caption Studio (Gujarati, Hindi, English + optional Hinglish/Gujlish)
  app.post('/api/ai/captions', aiGuard, async (req, res) => {
    try {
      const { brand, topic, platform, tone, ctaGoal, languages, includeRomanized } = req.body as {
        brand?: BrandContextPayload;
        topic?: string;
        platform?: string;
        tone?: string;
        ctaGoal?: string;
        languages?: string[];
        includeRomanized?: boolean;
      };

      if (!topic?.trim()) {
        res.status(400).json({ error: 'Post topic or creative brief is required.' });
        return;
      }

      const activeLangs = languages && languages.length ? languages : ['en', 'hi', 'gu'];
      const ai = getGenAIClient();

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            `Create native, culturally fluent social media captions for the following brief:`,
            `Topic / Brief: ${topic.trim()}`,
            `Platform: ${platform || 'Instagram'}`,
            `Desired Tone: ${tone || 'Match Brand Voice Memory'}`,
            `CTA Goal: ${ctaGoal || 'Encourage saves and meaningful comments'}`,
            `Requested Languages: ${activeLangs.join(', ')}`,
            `Include Romanized Hinglish & Gujlish variants: ${includeRomanized ? 'Yes' : 'No'}`,
            'CRITICAL QUALITY RULES:',
            '- For "gu", write natural, idiomatic native Gujarati script (ગુજરાતી)—never robotic literal translation.',
            '- For "hi", write natural, refined native Hindi Devanagari script (हिन्दी).',
            '- For "en", write crisp, editorial English.',
            '- Return empty string for any language not requested.',
          ].join('\n'),
          config: {
            systemInstruction: `You are a trilingual (Gujarati, Hindi, English) Creative Director at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                captions: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING },
                    hi: { type: Type.STRING },
                    gu: { type: Type.STRING },
                    hinglish: { type: Type.STRING },
                    gujlish: { type: Type.STRING },
                  },
                },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                cta: { type: Type.STRING },
                culturalNote: { type: Type.STRING },
              },
              required: ['title', 'captions', 'hashtags', 'cta'],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse multilingual caption output.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Captions AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate multilingual captions.',
      });
    }
  });

  // 3. Instagram Reel Hooks & Timecoded Script Lab
  app.post('/api/ai/reel-script', aiGuard, async (req, res) => {
    try {
      const { brand, topic, durationSec, primaryLanguage, hookStyle, goal } = req.body as {
        brand?: BrandContextPayload;
        topic?: string;
        durationSec?: number;
        primaryLanguage?: string;
        hookStyle?: string;
        goal?: string;
      };

      if (!topic?.trim()) {
        res.status(400).json({ error: 'Reel concept or topic is required.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            `Build an Instagram Reel production script and 5 scroll-stopping 0–3s hooks.`,
            `Topic: ${topic.trim()}`,
            `Target Duration: ${durationSec || 30} seconds`,
            `Primary Spoken Language: ${primaryLanguage || 'English + Gujarati'}`,
            `Hook Psychology: ${hookStyle || 'Curiosity gap & visual pattern interrupt'}`,
            `Conversion / Engagement Goal: ${goal || 'High 3-second retention and saves'}`,
            'If Gujarati or Hindi is requested, write natural native script lines for voiceover/on-screen text alongside clear English production direction.',
          ].join('\n'),
          config: {
            systemInstruction: `You are a Short-Form Video Director at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reelHooks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      angle: { type: Type.STRING },
                      spokenHook: { type: Type.STRING },
                      visualCue: { type: Type.STRING },
                      language: { type: Type.STRING },
                    },
                    required: ['angle', 'spokenHook', 'visualCue', 'language'],
                  },
                },
                reelScenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      timecode: { type: Type.STRING },
                      visualDirection: { type: Type.STRING },
                      onScreenText: { type: Type.STRING },
                      voiceover: { type: Type.STRING },
                      audioCue: { type: Type.STRING },
                    },
                    required: ['timecode', 'visualDirection', 'onScreenText', 'voiceover', 'audioCue'],
                  },
                },
                captionEn: { type: Type.STRING },
                captionLocal: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                cta: { type: Type.STRING },
              },
              required: ['title', 'reelHooks', 'reelScenes', 'captionEn', 'hashtags', 'cta'],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse Reel script output.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Reel Script AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate Reel script.',
      });
    }
  });

  // 4. Competitor Content Analysis (Supplied URL via urlContext OR Pasted Copy)
  app.post('/api/ai/competitor-analysis', aiGuard, async (req, res) => {
    try {
      const { brand, competitorName, sourceUrl, pastedContent } = req.body as {
        brand?: BrandContextPayload;
        competitorName?: string;
        sourceUrl?: string;
        pastedContent?: string;
      };

      if (!competitorName?.trim()) {
        res.status(400).json({ error: 'Competitor name is required.' });
        return;
      }

      if (!sourceUrl?.trim() && !pastedContent?.trim()) {
        res.status(400).json({
          error: 'Supply either a public competitor URL or pasted competitor content to analyze.',
        });
        return;
      }

      let safeUrl = '';
      if (sourceUrl?.trim()) {
        const validation = validateExternalHttpUrl(sourceUrl.trim());
        if (!validation.valid || !validation.normalizedUrl) {
          res.status(400).json({ error: validation.error || 'Invalid competitor URL.' });
          return;
        }
        safeUrl = validation.normalizedUrl;
      }

      const ai = getGenAIClient();
      const promptParts = [
        `Analyze competitor "${competitorName.trim()}" and build differentiated counter-angles for our client.`,
        safeUrl ? `Supplied Competitor URL to inspect: ${safeUrl}` : '',
        pastedContent?.trim()
          ? `Supplied Competitor Content / Captions / Transcript:\n${pastedContent.trim().slice(0, 6000)}`
          : '',
        'Return strict JSON with fields: summary (string), hookPatterns (string[]), contentGaps (string[]), and counterAngles (array of { title, format, angle, suggestedHook }).',
      ]
        .filter(Boolean)
        .join('\n\n');

      // Use Gemini urlContext tool when a URL is supplied
      const config: Record<string, unknown> = {
        systemInstruction: `You are a Competitive Social Intelligence Lead at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            hookPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
            contentGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            counterAngles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  format: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  suggestedHook: { type: Type.STRING },
                },
                required: ['title', 'format', 'angle', 'suggestedHook'],
              },
            },
          },
          required: ['summary', 'hookPatterns', 'contentGaps', 'counterAngles'],
        },
      };

      if (safeUrl) {
        config.tools = [{ urlContext: {} }];
      }

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: promptParts,
          config,
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse competitor analysis output.'
      );
      res.json({ ...parsed, sourceUrl: safeUrl });
    } catch (error) {
      console.error('Competitor AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to analyze competitor content.',
      });
    }
  });

  // 5. AI Content Repurposing Engine
  app.post('/api/ai/repurpose', aiGuard, async (req, res) => {
    try {
      const { brand, sourceTitle, sourceType, sourceContent, targetLanguage } = req.body as {
        brand?: BrandContextPayload;
        sourceTitle?: string;
        sourceType?: string;
        sourceContent?: string;
        targetLanguage?: string;
      };

      if (!sourceContent?.trim() || sourceContent.trim().length < 20) {
        res.status(400).json({
          error: 'Please paste source content (at least 20 characters) to repurpose.',
        });
        return;
      }

      const ai = getGenAIClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            `Repurpose the following ${sourceType || 'long-form asset'} into a multi-channel social kit:`,
            `Source Title: ${sourceTitle?.trim() || 'Untitled Pillar Asset'}`,
            `Primary Language Preference: ${targetLanguage || 'English with subtle regional resonance'}`,
            `Source Material:\n${sourceContent.trim().slice(0, 7000)}`,
          ].join('\n\n'),
          config: {
            systemInstruction: `You are a Content Distribution Architect at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                instagramCarousel: { type: Type.ARRAY, items: { type: Type.STRING } },
                reelScriptSummary: { type: Type.STRING },
                linkedinPost: { type: Type.STRING },
                threadsSequence: { type: Type.ARRAY, items: { type: Type.STRING } },
                whatsappBroadcast: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'title',
                'instagramCarousel',
                'reelScriptSummary',
                'linkedinPost',
                'threadsSequence',
                'whatsappBroadcast',
                'hashtags',
              ],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse repurposed content kit.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Repurpose AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to repurpose content.',
      });
    }
  });

  // 6. AI Revision Assistant for Approval Workflow
  app.post('/api/ai/revise', aiGuard, async (req, res) => {
    try {
      const { brand, title, captions, feedbackNote } = req.body as {
        brand?: BrandContextPayload;
        title?: string;
        captions?: Record<string, string>;
        feedbackNote?: string;
      };

      if (!feedbackNote?.trim()) {
        res.status(400).json({ error: 'Reviewer feedback note is required for revision.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            `Revise the following content asset based strictly on the reviewer feedback:`,
            `Asset Title: ${title || 'Untitled Asset'}`,
            `Current Captions: ${JSON.stringify(captions || {})}`,
            `Reviewer Revision Request: ${feedbackNote.trim()}`,
            'Preserve native Gujarati and Hindi fluency where present.',
          ].join('\n\n'),
          config: {
            systemInstruction: `You are a Senior Agency Copy Editor at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                captions: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING },
                    hi: { type: Type.STRING },
                    gu: { type: Type.STRING },
                  },
                },
                revisionSummary: { type: Type.STRING },
              },
              required: ['captions', 'revisionSummary'],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse revised copy.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Revision AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate AI revision.',
      });
    }
  });

  // 7. Performance Analysis & Strategic Recommendations
  app.post('/api/ai/performance-insights', aiGuard, async (req, res) => {
    try {
      const { brand, metrics, summary } = req.body as {
        brand?: BrandContextPayload;
        metrics?: Array<Record<string, unknown>>;
        summary?: Record<string, unknown>;
      };

      if (!Array.isArray(metrics) || metrics.length === 0) {
        res.status(400).json({ error: 'At least one performance metric row is required.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            'Analyze the client social media performance dataset below and produce executive agency recommendations.',
            `Summary Stats: ${JSON.stringify(summary || {})}`,
            `Post-Level Metrics: ${JSON.stringify(metrics.slice(0, 40))}`,
            'Be quantitative, reference actual formats/languages/pillars from the data, and propose one concrete next-month experiment.',
          ].join('\n\n'),
          config: {
            systemInstruction: `You are the Head of Growth Analytics at Sudershan AI.\n${formatBrandContextPrompt(brand)}`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                executiveSummary: { type: Type.STRING },
                doubleDown: { type: Type.ARRAY, items: { type: Type.STRING } },
                adjustments: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextMonthExperiment: { type: Type.STRING },
              },
              required: [
                'headline',
                'executiveSummary',
                'doubleDown',
                'adjustments',
                'nextMonthExperiment',
              ],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        response.text,
        'Failed to parse performance recommendations.'
      );
      res.json(parsed);
    } catch (error) {
      console.error('Performance AI error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate performance insights.',
      });
    }
  });

  // 7b. Daily Research & One-Post-Per-Day Autopilot (Google Search Grounding + Structured Pack)
  app.post('/api/ai/daily-autopilot', aiGuard, async (req, res) => {
    try {
      const { brand, targetDate, formatPreference, languages, focusTopic, recentTopics } =
        req.body as {
          brand?: BrandContextPayload;
          targetDate?: string;
          formatPreference?: 'Auto' | 'Reel' | 'Carousel' | 'Static';
          languages?: string[];
          focusTopic?: string;
          recentTopics?: string[];
        };

      const safeDate =
        typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())
          ? targetDate.trim()
          : new Date().toISOString().slice(0, 10);

      const safeFormat =
        formatPreference && ['Auto', 'Reel', 'Carousel', 'Static'].includes(formatPreference)
          ? formatPreference
          : 'Auto';

      const activeLangs =
        Array.isArray(languages) && languages.length > 0
          ? languages.filter((l) => ['en', 'hi', 'gu'].includes(l)).slice(0, 3)
          : ['en', 'hi', 'gu'];

      const avoidList = Array.isArray(recentTopics)
        ? recentTopics
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .slice(0, 10)
        : [];

      const ai = getGenAIClient();
      const brandPrompt = formatBrandContextPrompt(brand);

      // Step 1: Attempt live Google Search grounding; if Search tool quota is unavailable
      // on the active key tier, fall back cleanly to Gemini trend & niche research.
      let researchSummary = '';
      let researchMode: 'google_search' | 'brand_intelligence' = 'google_search';
      const sources: Array<{ title: string; url: string }> = [];

      const researchPrompt = [
        `Research timely trends, audience questions, seasonal moments, and high-performing Instagram content angles for ${safeDate}.`,
        `Brand Industry: ${brand?.industry || 'Social Media & Digital Agency'}`,
        `Primary Markets: ${brand?.primaryMarkets || 'India & Global'}`,
        focusTopic?.trim()
          ? `Specific Focus / Niche Topic to Research: ${focusTopic.trim().slice(0, 300)}`
          : 'No fixed topic supplied—autonomously identify the highest-opportunity trend or audience question right now for this brand.',
        avoidList.length > 0
          ? `Do NOT repeat these recently covered topics: ${avoidList.join('; ')}`
          : '',
        'Summarize 4 crisp, factual research findings and explain the single strongest angle for today’s Instagram post.',
      ]
        .filter(Boolean)
        .join('\n');

      if (Date.now() >= googleSearchCooldownUntil) {
        try {
          const researchResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: researchPrompt,
            config: {
              systemInstruction: `You are the Research & Trend Intelligence Lead at Sudershan AI. Use live Google Search to ground your brief in real, timely trends and facts.\n${brandPrompt}`,
              tools: [{ googleSearch: {} }],
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });

          researchSummary = (researchResponse.text || '').trim().slice(0, 4500);

          // Extract grounded web sources safely
          const rawChunks =
            researchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const seenUrls = new Set<string>();
          for (const chunk of rawChunks) {
            const uri = chunk?.web?.uri;
            const title = chunk?.web?.title;
            if (typeof uri === 'string' && /^https?:\/\//i.test(uri) && !seenUrls.has(uri)) {
              seenUrls.add(uri);
              sources.push({
                title: (typeof title === 'string' && title.trim()) || uri,
                url: uri,
              });
              if (sources.length >= 6) break;
            }
          }
        } catch (searchErr) {
          const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
          if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
            googleSearchCooldownUntil = Date.now() + 10 * 60_000;
          }
          console.warn(
            'Daily Autopilot Google Search grounding unavailable on current quota tier; continuing with Gemini trend & brand research:',
            msg
          );
          researchMode = 'brand_intelligence';
        }
      } else {
        researchMode = 'brand_intelligence';
      }

      // Step 2: Synthesize one complete, ready-to-post daily deliverable
      const synthesisPrompt = [
        researchSummary
          ? `Based on the live web research below, create ONE complete, publish-ready daily Instagram deliverable for ${safeDate}.`
          : `Research timely seasonal opportunities, audience pain points, and high-retention Instagram trends for ${safeDate}, then create ONE complete, publish-ready daily Instagram deliverable.`,
        `Format Preference: ${
          safeFormat === 'Auto'
            ? 'Choose the single highest-impact format (Reel, Carousel, or Static) for this angle.'
            : `MUST use format: ${safeFormat}.`
        }`,
        `Requested Caption Languages: ${activeLangs.join(', ')} (write empty string for unrequested languages).`,
        focusTopic?.trim() ? `User Topic Direction: ${focusTopic.trim().slice(0, 300)}` : '',
        avoidList.length > 0 ? `Avoid repeating recent titles: ${avoidList.join('; ')}` : '',
        researchSummary ? `LIVE RESEARCH BRIEF:\n${researchSummary}` : '',
        'CRITICAL OUTPUT RULES:',
        '- Include 3-4 crisp researchHighlights explaining the audience trend, seasonal relevance, and Instagram format rationale.',
        '- For "gu", write natural native Gujarati script (ગુજરાતી). For "hi", write natural Hindi Devanagari (हिन्दी). For "en", write crisp editorial English.',
        '- If chosenFormat is "Reel", populate 3 strong 0-3s reelHooks and 4-5 timecoded reelScenes (and return an empty array for carouselSlides).',
        '- If chosenFormat is "Carousel", populate 5-7 crisp slide-by-slide carouselSlides (and return empty arrays for reelHooks and reelScenes).',
        '- If chosenFormat is "Static", give a rich visualBrief for the single hero graphic/photo (and return empty arrays for carouselSlides, reelHooks, and reelScenes).',
        '- Never use banned terms from the client Brand Memory.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const synthesisResponse = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: synthesisPrompt,
          config: {
            systemInstruction: `You are the Daily Content Producer & Creative Director at Sudershan AI.\n${brandPrompt}`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                chosenFormat: { type: Type.STRING, enum: ['Reel', 'Carousel', 'Static'] },
                whyToday: { type: Type.STRING },
                researchHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                title: { type: Type.STRING },
                pillar: { type: Type.STRING },
                bestPostingTime: { type: Type.STRING },
                captions: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING },
                    hi: { type: Type.STRING },
                    gu: { type: Type.STRING },
                  },
                },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                cta: { type: Type.STRING },
                visualBrief: { type: Type.STRING },
                carouselSlides: { type: Type.ARRAY, items: { type: Type.STRING } },
                reelHooks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      angle: { type: Type.STRING },
                      spokenHook: { type: Type.STRING },
                      visualCue: { type: Type.STRING },
                      language: { type: Type.STRING },
                    },
                    required: ['angle', 'spokenHook', 'visualCue', 'language'],
                  },
                },
                reelScenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      timecode: { type: Type.STRING },
                      visualDirection: { type: Type.STRING },
                      onScreenText: { type: Type.STRING },
                      voiceover: { type: Type.STRING },
                      audioCue: { type: Type.STRING },
                    },
                    required: [
                      'timecode',
                      'visualDirection',
                      'onScreenText',
                      'voiceover',
                      'audioCue',
                    ],
                  },
                },
              },
              required: [
                'chosenFormat',
                'whyToday',
                'researchHighlights',
                'title',
                'pillar',
                'bestPostingTime',
                'captions',
                'hashtags',
                'cta',
                'visualBrief',
              ],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        synthesisResponse.text,
        'Failed to parse daily autopilot content pack.'
      );

      res.json({
        ...parsed,
        dateLabel: safeDate,
        researchMode,
        sources,
      });
    } catch (error) {
      console.error('Daily Autopilot AI error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to research and generate today’s daily post.',
      });
    }
  });

  // 7c. Smart Adaptive Loop: Analyze Past Posts + Research -> Propose Memory Updates -> Build New 7-Day Plan
  app.post('/api/ai/adaptive-plan', aiGuard, async (req, res) => {
    try {
      const { brand, startDate, goal, languages, recentAssets, metrics, performanceSummary } =
        req.body as {
          brand?: BrandContextPayload;
          startDate?: string;
          goal?: string;
          languages?: string[];
          recentAssets?: Array<{ title: string; format: string; pillar: string; status: string }>;
          metrics?: Array<Record<string, unknown>>;
          performanceSummary?: Record<string, unknown>;
        };

      const safeStart =
        typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())
          ? startDate.trim()
          : new Date().toISOString().slice(0, 10);

      const activeLangs =
        Array.isArray(languages) && languages.length > 0
          ? languages.filter((l) => ['en', 'hi', 'gu'].includes(l)).slice(0, 3)
          : ['en', 'hi', 'gu'];

      const ai = getGenAIClient();
      const brandPrompt = formatBrandContextPrompt(brand);

      let researchSummary = '';
      let researchMode: 'google_search' | 'brand_intelligence' = 'google_search';
      const sources: Array<{ title: string; url: string }> = [];

      // Step 1: Attempt live Google Search trend research with graceful fallback
      if (Date.now() >= googleSearchCooldownUntil) {
        try {
          const searchResp = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
              `Research current Instagram trends, audience questions, and seasonal opportunities starting ${safeStart} for ${brand?.industry || 'social media agency'}.`,
              `Markets: ${brand?.primaryMarkets || 'India & Global'}`,
              goal?.trim() ? `Growth Goal: ${goal.trim().slice(0, 300)}` : '',
              'Summarize the top 4 fresh trends we should pivot into over the next 7 days.',
            ]
              .filter(Boolean)
              .join('\n'),
            config: {
              systemInstruction: `You are the Research & Growth Strategist at Sudershan AI.\n${brandPrompt}`,
              tools: [{ googleSearch: {} }],
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });

          researchSummary = (searchResp.text || '').trim().slice(0, 4000);
          const rawChunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const seen = new Set<string>();
          for (const chunk of rawChunks) {
            const uri = chunk?.web?.uri;
            const title = chunk?.web?.title;
            if (typeof uri === 'string' && /^https?:\/\//i.test(uri) && !seen.has(uri)) {
              seen.add(uri);
              sources.push({ title: (typeof title === 'string' && title.trim()) || uri, url: uri });
              if (sources.length >= 6) break;
            }
          }
        } catch (searchErr) {
          const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
          if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
            googleSearchCooldownUntil = Date.now() + 10 * 60_000;
          }
          console.warn(
            'Adaptive Plan Google Search grounding unavailable on current quota tier; continuing with Gemini performance & trend analysis:',
            msg
          );
          researchMode = 'brand_intelligence';
        }
      } else {
        researchMode = 'brand_intelligence';
      }

      // Step 2: Diagnose past performance + propose Brand Memory updates + build a brand-new 7-day daily plan
      const adaptivePrompt = [
        `Run a closed-loop Instagram growth review starting ${safeStart} (1 post per day for 7 days, dayOffset 0 through 6).`,
        goal?.trim()
          ? `Target Growth Goal: ${goal.trim().slice(0, 300)}`
          : 'Target Growth Goal: Maximize saves, shares, and qualified inquiries with 1 high-signal post per day.',
        `Active Languages: ${activeLangs.join(', ')}`,
        `RECENT POSTS & DRAFTS:\n${JSON.stringify((recentAssets || []).slice(0, 12))}`,
        `PERFORMANCE SUMMARY:\n${JSON.stringify(performanceSummary || {})}`,
        `POST-LEVEL METRICS:\n${JSON.stringify((metrics || []).slice(0, 25))}`,
        researchSummary ? `FRESH TREND RESEARCH:\n${researchSummary}` : '',
        'REQUIREMENTS:',
        '1. diagnosisSummary: Concisely diagnose what worked and what must change based on the metrics and recent posts.',
        '2. whatChanged: 3 crisp bullets describing the concrete strategic adjustments applied to the new plan.',
        '3. memoryUpdates: 2-3 specific Brand Memory rules to add (winning_pattern, voice_rule, content_pillar, or do_not_use) so future AI outputs automatically adapt.',
        '4. slots: Exactly 7 daily slots (dayOffset 0, 1, 2, 3, 4, 5, 6) with varied high-performing formats (Reel, Carousel, Static), zero repetition of recent titles, concrete hook ideas, and requested languages.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const planResponse = await generateWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: adaptivePrompt,
          config: {
            systemInstruction: `You are the Head of Adaptive Content Strategy at Sudershan AI.\n${brandPrompt}`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                diagnosisSummary: { type: Type.STRING },
                whatChanged: { type: Type.ARRAY, items: { type: Type.STRING } },
                memoryUpdates: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        enum: ['winning_pattern', 'voice_rule', 'content_pillar', 'do_not_use'],
                      },
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      languageScope: { type: Type.STRING, enum: ['all', 'en', 'hi', 'gu'] },
                    },
                    required: ['category', 'title', 'detail', 'languageScope'],
                  },
                },
                planLabel: { type: Type.STRING },
                planObjective: { type: Type.STRING },
                slots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dayOffset: { type: Type.INTEGER },
                      format: { type: Type.STRING, enum: ['Reel', 'Carousel', 'Static', 'Story'] },
                      pillar: { type: Type.STRING },
                      topic: { type: Type.STRING },
                      hookIdea: { type: Type.STRING },
                      languages: { type: Type.ARRAY, items: { type: Type.STRING } },
                      ctaGoal: { type: Type.STRING },
                    },
                    required: [
                      'dayOffset',
                      'format',
                      'pillar',
                      'topic',
                      'hookIdea',
                      'languages',
                      'ctaGoal',
                    ],
                  },
                },
              },
              required: [
                'diagnosisSummary',
                'whatChanged',
                'memoryUpdates',
                'planLabel',
                'planObjective',
                'slots',
              ],
            },
          },
        })
      );

      const parsed = safeJsonParse<Record<string, unknown>>(
        planResponse.text,
        'Failed to parse adaptive plan output.'
      );

      res.json({
        ...parsed,
        researchMode,
        sources,
      });
    } catch (error) {
      console.error('Adaptive Plan AI error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to run adaptive research and build a new plan.',
      });
    }
  });

  // 8. BrightBean Studio Outbound Webhook Handoff (Strictly Authenticated + SSRF Validated)
  app.post('/api/integrations/brightbean/handoff', async (req, res) => {
    try {
      const verified = await verifyFirebaseBearerToken(req.headers.authorization);
      if (!verified) {
        res.status(401).json({
          error: 'Sign in with your Google account to dispatch live webhooks to BrightBean Studio.',
        });
        return;
      }

      const { webhookUrl, payload } = req.body as {
        webhookUrl?: string;
        payload?: Record<string, unknown>;
      };

      const urlCheck = validateExternalHttpUrl(webhookUrl || '');
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        res.status(400).json({ error: urlCheck.error || 'Invalid BrightBean webhook URL.' });
        return;
      }

      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ error: 'Handoff payload object is required.' });
        return;
      }

      const bodyString = JSON.stringify({
        ...payload,
        dispatchedBy: verified.email,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sudershan-AI-BrightBean-Bridge/1.0',
      };

      const signingSecret = process.env.BRIGHTBEAN_WEBHOOK_SECRET;
      if (signingSecret) {
        const signature = crypto
          .createHmac('sha256', signingSecret)
          .update(bodyString)
          .digest('hex');
        headers['X-Sudershan-Signature'] = `sha256=${signature}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const upstream = await fetch(urlCheck.normalizedUrl, {
          method: 'POST',
          headers,
          body: bodyString,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const reference = `BB-${Date.now().toString(36).toUpperCase()}`;
        if (!upstream.ok) {
          res.status(502).json({
            error: `BrightBean endpoint responded with HTTP ${upstream.status}.`,
          });
          return;
        }
        res.json({
          delivered: true,
          statusCode: upstream.status,
          reference,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        res.status(502).json({
          error:
            fetchErr instanceof Error
              ? `Could not reach BrightBean webhook endpoint: ${fetchErr.message}`
              : 'Failed to reach BrightBean webhook endpoint.',
        });
      }
    } catch (error) {
      console.error('BrightBean handoff error:', error);
      res.status(500).json({ error: 'Unexpected error while dispatching BrightBean handoff.' });
    }
  });

  // Mount Vite middlewares in dev OR static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sudershan AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sudershan AI server:', err);
  process.exit(1);
});
