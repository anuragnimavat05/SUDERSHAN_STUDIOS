import { auth } from '../firebase';
import type {
  BrandContextPayload,
  CalendarSlot,
  CaptionVariants,
  CompetitorReport,
  PerformanceMetric,
  PerformanceRecommendation,
  ReelHook,
  ReelScene,
  RepurposedOutputs,
} from '../types/studio';

async function getAuthHeaders(isDemoMode: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  } else if (isDemoMode) {
    headers['X-Sudershan-Mode'] = 'demo';
  }
  return headers;
}

async function postJson<T>(url: string, body: unknown, isDemoMode: boolean): Promise<T> {
  const headers = await getAuthHeaders(isDemoMode);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error || `Request failed with HTTP ${response.status}`);
  }
  return data;
}

export async function generateMonthlyCalendarApi(
  payload: {
    brand: BrandContextPayload;
    monthLabel: string;
    objective: string;
    cadencePerWeek: number;
    focusPillars: string;
    languages: string[];
  },
  isDemoMode: boolean
): Promise<{ slots: Omit<CalendarSlot, 'id'>[] }> {
  return postJson('/api/ai/calendar', payload, isDemoMode);
}

export async function generateMultilingualCaptionsApi(
  payload: {
    brand: BrandContextPayload;
    topic: string;
    platform: string;
    tone: string;
    ctaGoal: string;
    languages: string[];
    includeRomanized: boolean;
  },
  isDemoMode: boolean
): Promise<{
  title: string;
  captions: CaptionVariants;
  hashtags: string[];
  cta: string;
  culturalNote?: string;
}> {
  return postJson('/api/ai/captions', payload, isDemoMode);
}

export async function generateReelScriptApi(
  payload: {
    brand: BrandContextPayload;
    topic: string;
    durationSec: number;
    primaryLanguage: string;
    hookStyle: string;
    goal: string;
  },
  isDemoMode: boolean
): Promise<{
  title: string;
  reelHooks: ReelHook[];
  reelScenes: ReelScene[];
  captionEn: string;
  captionLocal?: string;
  hashtags: string[];
  cta: string;
}> {
  return postJson('/api/ai/reel-script', payload, isDemoMode);
}

export async function analyzeCompetitorApi(
  payload: {
    brand: BrandContextPayload;
    competitorName: string;
    sourceUrl?: string;
    pastedContent?: string;
  },
  isDemoMode: boolean
): Promise<
  Pick<CompetitorReport, 'summary' | 'hookPatterns' | 'contentGaps' | 'counterAngles' | 'sourceUrl'>
> {
  return postJson('/api/ai/competitor-analysis', payload, isDemoMode);
}

export async function repurposeContentApi(
  payload: {
    brand: BrandContextPayload;
    sourceTitle: string;
    sourceType: string;
    sourceContent: string;
    targetLanguage: string;
  },
  isDemoMode: boolean
): Promise<
  RepurposedOutputs & {
    title: string;
    hashtags: string[];
  }
> {
  return postJson('/api/ai/repurpose', payload, isDemoMode);
}

export async function generateAiRevisionApi(
  payload: {
    brand: BrandContextPayload;
    title: string;
    captions: Record<string, string>;
    feedbackNote: string;
  },
  isDemoMode: boolean
): Promise<{
  captions: CaptionVariants;
  revisionSummary: string;
}> {
  return postJson('/api/ai/revise', payload, isDemoMode);
}

export async function generatePerformanceInsightsApi(
  payload: {
    brand: BrandContextPayload;
    metrics: PerformanceMetric[];
    summary: Record<string, unknown>;
  },
  isDemoMode: boolean
): Promise<
  Pick<
    PerformanceRecommendation,
    'headline' | 'executiveSummary' | 'doubleDown' | 'adjustments' | 'nextMonthExperiment'
  >
> {
  return postJson('/api/ai/performance-insights', payload, isDemoMode);
}

export async function dispatchBrightBeanWebhookApi(
  payload: {
    webhookUrl: string;
    payload: Record<string, unknown>;
  },
  isDemoMode: boolean
): Promise<{ delivered: boolean; statusCode: number; reference: string }> {
  return postJson('/api/integrations/brightbean/handoff', payload, isDemoMode);
}

export async function generateDailyAutopilotApi(
  payload: {
    brand: BrandContextPayload;
    targetDate: string;
    formatPreference: 'Auto' | 'Reel' | 'Carousel' | 'Static';
    languages: string[];
    focusTopic?: string;
    recentTopics: string[];
  },
  isDemoMode: boolean
): Promise<import('../types/studio').DailyAutopilotResult> {
  return postJson('/api/ai/daily-autopilot', payload, isDemoMode);
}

export async function generateAdaptivePlanApi(
  payload: {
    brand: BrandContextPayload;
    startDate: string;
    goal?: string;
    languages: string[];
    recentAssets: Array<{ title: string; format: string; pillar: string; status: string }>;
    metrics: PerformanceMetric[];
    performanceSummary: Record<string, unknown>;
  },
  isDemoMode: boolean
): Promise<import('../types/studio').AdaptivePlanResult> {
  return postJson('/api/ai/adaptive-plan', payload, isDemoMode);
}
