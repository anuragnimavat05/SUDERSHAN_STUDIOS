import type {
  AgencyRole,
  AssetStatus,
  ClientWorkspace,
  ContentAsset,
  PerformanceMetric,
} from '../types/studio';

export interface RolePermissions {
  canManageClient: boolean;
  canManageMembers: boolean;
  canEditBrand: boolean;
  canCreateContent: boolean;
  canSubmitReview: boolean;
  canReviewAsset: boolean;
  canDispatchHandoff: boolean;
}

export function getRolePermissions(role: AgencyRole): RolePermissions {
  if (role === 'admin') {
    return {
      canManageClient: true,
      canManageMembers: true,
      canEditBrand: true,
      canCreateContent: true,
      canSubmitReview: true,
      canReviewAsset: true,
      canDispatchHandoff: true,
    };
  }
  if (role === 'strategist') {
    return {
      canManageClient: false,
      canManageMembers: false,
      canEditBrand: true,
      canCreateContent: true,
      canSubmitReview: true,
      canReviewAsset: false,
      canDispatchHandoff: true,
    };
  }
  return {
    canManageClient: false,
    canManageMembers: false,
    canEditBrand: false,
    canCreateContent: false,
    canSubmitReview: false,
    canReviewAsset: true,
    canDispatchHandoff: false,
  };
}

export function canTransitionAssetStatus(
  role: AgencyRole,
  from: AssetStatus,
  to: AssetStatus
): boolean {
  if (from === to) return false;
  if (role === 'admin') return true;

  if (role === 'client_reviewer') {
    return from === 'in_review' && (to === 'approved' || to === 'revision_requested');
  }

  // Strategist transitions (cannot mutate handed_off terminal assets)
  if (from === 'handed_off') return false;
  if (from === 'draft' && to === 'in_review') return true;
  if (from === 'revision_requested' && (to === 'draft' || to === 'in_review')) return true;
  if (from === 'approved' && to === 'handed_off') return true;
  return false;
}

export interface BrightBeanHandoffPayload {
  schemaVersion: string;
  source: 'sudershan-ai';
  exportedAt: string;
  brightBeanWorkspaceId: string;
  client: {
    id: string;
    name: string;
    industry: string;
  };
  asset: {
    id: string;
    title: string;
    type: string;
    platform: string;
    pillar: string;
    version: number;
    approvalStatus: AssetStatus;
    languages: string[];
    captions: Record<string, string>;
    hashtags: string[];
    cta: string;
    reelHooks: Array<{ angle: string; spokenHook: string; visualCue: string; language: string }>;
    reelScenes: Array<{
      timecode: string;
      visualDirection: string;
      onScreenText: string;
      voiceover: string;
      audioCue: string;
    }>;
    repurposedOutputs: Record<string, unknown>;
  };
}

export function buildBrightBeanPayload(
  client: ClientWorkspace,
  asset: ContentAsset,
  exportedAt = new Date().toISOString()
): BrightBeanHandoffPayload {
  const captions: Record<string, string> = {};
  if (asset.captions) {
    for (const [k, v] of Object.entries(asset.captions)) {
      if (v) captions[k] = v;
    }
  }

  return {
    schemaVersion: '1.0',
    source: 'sudershan-ai',
    exportedAt,
    brightBeanWorkspaceId: client.brightBeanWorkspaceId || client.id,
    client: {
      id: client.id,
      name: client.name,
      industry: client.industry,
    },
    asset: {
      id: asset.id,
      title: asset.title,
      type: asset.assetType,
      platform: asset.platform,
      pillar: asset.pillar || '',
      version: asset.version,
      approvalStatus: asset.status,
      languages: asset.languages,
      captions,
      hashtags: asset.hashtags || [],
      cta: asset.cta || '',
      reelHooks: asset.reelHooks || [],
      reelScenes: asset.reelScenes || [],
      repurposedOutputs: (asset.repurposedOutputs as Record<string, unknown>) || {},
    },
  };
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildBrightBeanCsv(client: ClientWorkspace, assets: ContentAsset[]): string {
  const headers = [
    'brightbean_workspace_id',
    'client_name',
    'asset_id',
    'title',
    'asset_type',
    'platform',
    'pillar',
    'status',
    'version',
    'caption_en',
    'caption_hi',
    'caption_gu',
    'hashtags',
    'cta',
    'reel_script_summary',
  ];

  const rows = assets.map((asset) => {
    const reelSummary = (asset.reelScenes || [])
      .map((scene) => `[${scene.timecode}] ${scene.voiceover}`)
      .join(' | ');
    return [
      client.brightBeanWorkspaceId || client.id,
      client.name,
      asset.id,
      asset.title,
      asset.assetType,
      asset.platform,
      asset.pillar,
      asset.status,
      asset.version,
      asset.captions?.en || '',
      asset.captions?.hi || '',
      asset.captions?.gu || '',
      (asset.hashtags || []).join(' '),
      asset.cta || '',
      reelSummary,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export interface ParsedMetricInput {
  postTitle: string;
  publishedDate: string;
  format: PerformanceMetric['format'];
  language: PerformanceMetric['language'];
  pillar: string;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  avgWatchSec?: number;
}

export interface CsvParseResult {
  rows: ParsedMetricInput[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const VALID_FORMATS = new Set<PerformanceMetric['format']>(['Reel', 'Carousel', 'Static', 'Story']);
const VALID_LANGUAGES = new Set<PerformanceMetric['language']>([
  'English',
  'Hindi',
  'Gujarati',
  'Multilingual',
]);

export function parsePerformanceCsv(csvText: string): CsvParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: ['CSV must include a header row and at least one metric row.'],
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const idx = (name: string) => headers.indexOf(name);

  const titleIdx = idx('post_title');
  const dateIdx = idx('published_date');
  const formatIdx = idx('format');
  const langIdx = idx('language');
  const pillarIdx = idx('pillar');
  const reachIdx = idx('reach');
  const likesIdx = idx('likes');
  const commentsIdx = idx('comments');
  const savesIdx = idx('saves');
  const sharesIdx = idx('shares');
  const watchIdx = idx('avg_watch_sec');

  if (titleIdx === -1 || reachIdx === -1) {
    return {
      rows: [],
      errors: ['Required columns missing: expected at least post_title and reach.'],
    };
  }

  const rows: ParsedMetricInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const postTitle = cols[titleIdx]?.trim();
    const reach = Number(cols[reachIdx]);

    if (!postTitle) {
      errors.push(`Row ${i + 1}: missing post_title.`);
      continue;
    }
    if (!Number.isFinite(reach) || reach < 0) {
      errors.push(`Row ${i + 1}: reach must be a non-negative number.`);
      continue;
    }

    const rawFormat = (formatIdx !== -1 ? cols[formatIdx] : 'Reel') as PerformanceMetric['format'];
    const rawLanguage = (
      langIdx !== -1 ? cols[langIdx] : 'Multilingual'
    ) as PerformanceMetric['language'];

    const toNum = (columnIndex: number) => {
      if (columnIndex === -1 || !cols[columnIndex]) return 0;
      const n = Number(cols[columnIndex]);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    rows.push({
      postTitle: postTitle.slice(0, 160),
      publishedDate: (dateIdx !== -1 && cols[dateIdx]) || new Date().toISOString().slice(0, 10),
      format: VALID_FORMATS.has(rawFormat) ? rawFormat : 'Reel',
      language: VALID_LANGUAGES.has(rawLanguage) ? rawLanguage : 'Multilingual',
      pillar: (pillarIdx !== -1 && cols[pillarIdx]) || 'General',
      reach,
      likes: toNum(likesIdx),
      comments: toNum(commentsIdx),
      saves: toNum(savesIdx),
      shares: toNum(sharesIdx),
      avgWatchSec: watchIdx !== -1 && cols[watchIdx] ? toNum(watchIdx) : undefined,
    });
  }

  return { rows, errors };
}
