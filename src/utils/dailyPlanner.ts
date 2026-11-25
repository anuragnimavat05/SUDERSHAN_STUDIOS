import type { ContentAsset, DailyAutopilotResult } from '../types/studio';

export interface DailySlotCoverage {
  dateIso: string; // YYYY-MM-DD
  weekday: string; // Mon, Tue, ...
  dayNum: number;
  count: number;
  isToday: boolean;
  latestTitle?: string;
}

export interface SevenDayCoverageSummary {
  days: DailySlotCoverage[];
  coveredDays: number;
  todayCovered: boolean;
  streakDays: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(isoOrDate?: string): string | null {
  if (!isoOrDate) return null;
  const match = isoOrDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return toUtcDateKey(parsed);
}

/**
 * Computes a 7-day rolling "1 post per day" coverage summary ending on referenceDateIso.
 */
export function buildSevenDayCoverage(
  assets: ContentAsset[],
  referenceDateIso: string
): SevenDayCoverageSummary {
  const baseKey = parseDateKey(referenceDateIso) || toUtcDateKey(new Date());
  const [year, month, day] = baseKey.split('-').map(Number);
  const anchorUtc = new Date(Date.UTC(year, month - 1, day));

  const countsByDate = new Map<string, { count: number; latestTitle: string }>();
  for (const asset of assets) {
    const key = parseDateKey(asset.createdAt) || parseDateKey(asset.updatedAt);
    if (!key) continue;
    const prev = countsByDate.get(key);
    countsByDate.set(key, {
      count: (prev?.count || 0) + 1,
      latestTitle: prev?.latestTitle || asset.title,
    });
  }

  const days: DailySlotCoverage[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dt = new Date(anchorUtc.getTime() - offset * 86_400_000);
    const key = toUtcDateKey(dt);
    const entry = countsByDate.get(key);
    days.push({
      dateIso: key,
      weekday: WEEKDAYS[dt.getUTCDay()],
      dayNum: dt.getUTCDate(),
      count: entry?.count || 0,
      isToday: offset === 0,
      latestTitle: entry?.latestTitle,
    });
  }

  const coveredDays = days.filter((d) => d.count > 0).length;
  const todayCovered = days[days.length - 1].count > 0;

  // Streak counts consecutive covered days ending today (or yesterday if today isn't generated yet)
  let streakDays = 0;
  const startIndex = todayCovered ? days.length - 1 : days.length - 2;
  for (let i = startIndex; i >= 0; i -= 1) {
    if (days[i].count > 0) {
      streakDays += 1;
    } else {
      break;
    }
  }

  return {
    days,
    coveredDays,
    todayCovered,
    streakDays,
  };
}

/**
 * Formats a Daily Autopilot result into a clean copy-paste pack ready for
 * Meta Business Suite or BrightBean Studio scheduling.
 */
export function formatMetaCopyPack(pack: DailyAutopilotResult, clientName: string): string {
  const sections: string[] = [
    `${clientName} — Daily Instagram ${pack.chosenFormat} (${pack.dateLabel})`,
    `Title: ${pack.title}`,
    `Pillar: ${pack.pillar} | Best Time: ${pack.bestPostingTime}`,
  ];

  if (pack.captions.en?.trim()) {
    sections.push(`\n[ENGLISH CAPTION]\n${pack.captions.en.trim()}`);
  }
  if (pack.captions.hi?.trim()) {
    sections.push(`\n[HINDI CAPTION]\n${pack.captions.hi.trim()}`);
  }
  if (pack.captions.gu?.trim()) {
    sections.push(`\n[GUJARATI CAPTION]\n${pack.captions.gu.trim()}`);
  }

  if (pack.cta?.trim()) {
    sections.push(`\n[CTA]\n${pack.cta.trim()}`);
  }

  if (pack.hashtags.length > 0) {
    sections.push(`\n[HASHTAGS]\n${pack.hashtags.join(' ')}`);
  }

  if (pack.chosenFormat === 'Reel' && pack.reelScenes && pack.reelScenes.length > 0) {
    const hookLines = (pack.reelHooks || [])
      .map((h, idx) => `${idx + 1}. (${h.language.toUpperCase()} · ${h.angle}) "${h.spokenHook}" [Visual: ${h.visualCue}]`)
      .join('\n');
    if (hookLines) {
      sections.push(`\n[REEL HOOKS]\n${hookLines}`);
    }
    const sceneLines = pack.reelScenes
      .map(
        (s) =>
          `${s.timecode} | Visual: ${s.visualDirection} | Text: "${s.onScreenText}" | VO: ${s.voiceover}`
      )
      .join('\n');
    sections.push(`\n[REEL SCRIPT]\n${sceneLines}`);
  } else if (pack.carouselSlides && pack.carouselSlides.length > 0) {
    const slideLines = pack.carouselSlides.map((s, idx) => `Slide ${idx + 1}: ${s}`).join('\n');
    sections.push(`\n[CAROUSEL SLIDES]\n${slideLines}`);
  }

  if (pack.visualBrief?.trim()) {
    sections.push(`\n[VISUAL / DESIGN DIRECTION]\n${pack.visualBrief.trim()}`);
  }

  return sections.join('\n');
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Maps AI-generated adaptive day offsets (0..6) onto concrete CalendarSlot objects
 * starting at startDateIso (YYYY-MM-DD).
 */
export function buildAdaptiveCalendarSlots(
  rawSlots: Array<{
    dayOffset: number;
    format: 'Reel' | 'Carousel' | 'Static' | 'Story';
    pillar: string;
    topic: string;
    hookIdea: string;
    languages: string[];
    ctaGoal: string;
  }>,
  startDateIso: string
): import('../types/studio').CalendarSlot[] {
  const baseKey = parseDateKey(startDateIso) || toUtcDateKey(new Date());
  const [year, month, day] = baseKey.split('-').map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day));

  return rawSlots.slice(0, 14).map((slot, index) => {
    const offset = Number.isFinite(slot.dayOffset) && slot.dayOffset >= 0 ? Math.floor(slot.dayOffset) : index;
    const dt = new Date(startUtc.getTime() + offset * 86_400_000);
    const dayOfMonth = dt.getUTCDate();
    const dateLabel = `${MONTH_SHORT[dt.getUTCMonth()]} ${String(dayOfMonth).padStart(2, '0')}`;
    const validFormats = new Set(['Reel', 'Carousel', 'Static', 'Story']);
    const format = validFormats.has(slot.format) ? slot.format : 'Reel';

    return {
      id: `adaptive-slot-${index + 1}`,
      dayOfMonth,
      dateLabel,
      format,
      pillar: (slot.pillar || 'Growth').slice(0, 80),
      topic: (slot.topic || `Daily Post ${index + 1}`).slice(0, 180),
      hookIdea: (slot.hookIdea || '').slice(0, 240),
      languages: Array.isArray(slot.languages) && slot.languages.length > 0 ? slot.languages.slice(0, 3) : ['en'],
      ctaGoal: (slot.ctaGoal || 'Save and share').slice(0, 160),
    };
  });
}
