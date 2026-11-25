export type AgencyRole = 'admin' | 'strategist' | 'client_reviewer';

export type MemoryCategory =
  | 'voice_rule'
  | 'audience_persona'
  | 'content_pillar'
  | 'cultural_context'
  | 'do_not_use'
  | 'winning_pattern';

export type LanguageCode = 'en' | 'hi' | 'gu' | 'hinglish' | 'gujlish';

export type AssetType =
  | 'caption_pack'
  | 'reel_script'
  | 'repurposed_kit'
  | 'calendar_brief'
  | 'competitor_counter';

export type AssetStatus =
  | 'draft'
  | 'in_review'
  | 'revision_requested'
  | 'approved'
  | 'handed_off';

export type BrightBeanStatus = 'pending' | 'exported' | 'webhook_sent';

export type StudioView =
  | 'brand'
  | 'daily'
  | 'calendar'
  | 'captions'
  | 'reels'
  | 'competitors'
  | 'repurpose'
  | 'approvals'
  | 'performance';

export interface MemberDirectoryEntry {
  uid: string;
  name: string;
  email: string;
  role: AgencyRole;
}

export interface ClientWorkspace {
  id: string;
  name: string;
  monogram: string;
  industry: string;
  website: string;
  primaryMarkets: string;
  brandSummary: string;
  bannedTerms: string;
  defaultLanguages: string[];
  brightBeanWorkspaceId: string;
  brightBeanWebhookUrl: string;
  ownerUid: string;
  memberUids: string[];
  memberRoles: Record<string, AgencyRole>;
  memberDirectory: MemberDirectoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandMemoryItem {
  id: string;
  clientId: string;
  category: MemoryCategory;
  title: string;
  detail: string;
  languageScope: 'all' | 'en' | 'hi' | 'gu';
  authorUid: string;
  memberUids: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarSlot {
  id: string;
  dayOfMonth: number;
  dateLabel: string;
  format: 'Reel' | 'Carousel' | 'Static' | 'Story';
  pillar: string;
  topic: string;
  hookIdea: string;
  languages: string[];
  ctaGoal: string;
  linkedAssetId?: string;
}

export interface MonthlyCalendar {
  id: string;
  clientId: string;
  monthLabel: string;
  objective: string;
  cadencePerWeek: number;
  slots: CalendarSlot[];
  authorUid: string;
  memberUids: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CaptionVariants {
  en?: string;
  hi?: string;
  gu?: string;
  hinglish?: string;
  gujlish?: string;
}

export interface ReelHook {
  angle: string;
  spokenHook: string;
  visualCue: string;
  language: string;
}

export interface ReelScene {
  timecode: string;
  visualDirection: string;
  onScreenText: string;
  voiceover: string;
  audioCue: string;
}

export interface RepurposedOutputs {
  instagramCarousel?: string[];
  reelScriptSummary?: string;
  linkedinPost?: string;
  threadsSequence?: string[];
  whatsappBroadcast?: string;
}

export interface ContentAsset {
  id: string;
  clientId: string;
  title: string;
  assetType: AssetType;
  platform: string;
  pillar: string;
  status: AssetStatus;
  version: number;
  languages: string[];
  captions?: CaptionVariants;
  hashtags?: string[];
  cta?: string;
  reelHooks?: ReelHook[];
  reelScenes?: ReelScene[];
  repurposedOutputs?: RepurposedOutputs;
  reviewerNote?: string;
  brightBeanStatus: BrightBeanStatus;
  brightBeanReference?: string;
  authorUid: string;
  memberUids: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetRevision {
  id: string;
  clientId: string;
  assetId: string;
  version: number;
  action: 'created' | 'submitted' | 'revision_requested' | 'revised' | 'approved' | 'handed_off';
  note: string;
  actorName: string;
  actorRole: AgencyRole;
  authorUid: string;
  memberUids: string[];
  createdAt: string;
}

export interface CompetitorReport {
  id: string;
  clientId: string;
  competitorName: string;
  sourceUrl?: string;
  summary: string;
  hookPatterns: string[];
  contentGaps: string[];
  counterAngles: Array<{
    title: string;
    format: string;
    angle: string;
    suggestedHook: string;
  }>;
  authorUid: string;
  memberUids: string[];
  createdAt: string;
}

export interface PerformanceMetric {
  id: string;
  clientId: string;
  postTitle: string;
  publishedDate: string;
  format: 'Reel' | 'Carousel' | 'Static' | 'Story';
  language: 'English' | 'Hindi' | 'Gujarati' | 'Multilingual';
  pillar: string;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  avgWatchSec?: number;
  authorUid: string;
  memberUids: string[];
  createdAt?: string;
}

export interface PerformanceRecommendation {
  id: string;
  clientId: string;
  headline: string;
  executiveSummary: string;
  doubleDown: string[];
  adjustments: string[];
  nextMonthExperiment: string;
  authorUid: string;
  memberUids: string[];
  createdAt: string;
}

export interface BrandContextPayload {
  name: string;
  industry: string;
  primaryMarkets: string;
  brandSummary: string;
  bannedTerms: string;
  defaultLanguages: string[];
  memory: Array<{
    category: MemoryCategory;
    title: string;
    detail: string;
    languageScope: string;
  }>;
}

export interface DailyResearchSource {
  title: string;
  url: string;
}

export interface DailyAutopilotResult {
  dateLabel: string;
  researchMode?: 'google_search' | 'brand_intelligence';
  chosenFormat: 'Reel' | 'Carousel' | 'Static';
  whyToday: string;
  researchHighlights: string[];
  sources: DailyResearchSource[];
  title: string;
  pillar: string;
  bestPostingTime: string;
  captions: CaptionVariants;
  hashtags: string[];
  cta: string;
  visualBrief: string;
  carouselSlides?: string[];
  reelHooks?: ReelHook[];
  reelScenes?: ReelScene[];
}

export interface AdaptiveMemorySuggestion {
  category: 'winning_pattern' | 'voice_rule' | 'content_pillar' | 'do_not_use';
  title: string;
  detail: string;
  languageScope: 'all' | 'en' | 'hi' | 'gu';
}

export interface AdaptivePlanResult {
  researchMode: 'google_search' | 'brand_intelligence';
  diagnosisSummary: string;
  whatChanged: string[];
  sources: DailyResearchSource[];
  memoryUpdates: AdaptiveMemorySuggestion[];
  planLabel: string;
  planObjective: string;
  slots: Array<{
    dayOffset: number;
    format: 'Reel' | 'Carousel' | 'Static' | 'Story';
    pillar: string;
    topic: string;
    hookIdea: string;
    languages: string[];
    ctaGoal: string;
  }>;
}
