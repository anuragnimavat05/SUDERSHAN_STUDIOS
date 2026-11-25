import type { PerformanceMetric } from '../types/studio';

export function calculateEngagementRate(metric: Pick<PerformanceMetric, 'reach' | 'likes' | 'comments' | 'saves' | 'shares'>): number {
  if (!metric.reach || metric.reach <= 0) return 0;
  const totalEngagements = metric.likes + metric.comments + metric.saves + metric.shares;
  return Number(((totalEngagements / metric.reach) * 100).toFixed(2));
}

export function calculateSaveRate(metric: Pick<PerformanceMetric, 'reach' | 'saves'>): number {
  if (!metric.reach || metric.reach <= 0) return 0;
  return Number(((metric.saves / metric.reach) * 100).toFixed(2));
}

export interface BreakdownPoint {
  label: string;
  posts: number;
  avgReach: number;
  avgEngagementRate: number;
  avgSaveRate: number;
}

export interface PerformanceSummary {
  totalPosts: number;
  totalReach: number;
  avgEngagementRate: number;
  avgSaveRate: number;
  totalSaves: number;
  totalShares: number;
  topFormat: string;
  topLanguage: string;
  byFormat: BreakdownPoint[];
  byLanguage: BreakdownPoint[];
}

function buildBreakdown(
  metrics: PerformanceMetric[],
  keyFn: (m: PerformanceMetric) => string
): BreakdownPoint[] {
  const groups = new Map<string, PerformanceMetric[]>();
  for (const item of metrics) {
    const key = keyFn(item);
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([label, items]) => {
      const avgReach = Math.round(items.reduce((sum, m) => sum + m.reach, 0) / items.length);
      const avgEngagementRate = Number(
        (items.reduce((sum, m) => sum + calculateEngagementRate(m), 0) / items.length).toFixed(2)
      );
      const avgSaveRate = Number(
        (items.reduce((sum, m) => sum + calculateSaveRate(m), 0) / items.length).toFixed(2)
      );
      return {
        label,
        posts: items.length,
        avgReach,
        avgEngagementRate,
        avgSaveRate,
      };
    })
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export function summarizePerformance(metrics: PerformanceMetric[]): PerformanceSummary {
  if (metrics.length === 0) {
    return {
      totalPosts: 0,
      totalReach: 0,
      avgEngagementRate: 0,
      avgSaveRate: 0,
      totalSaves: 0,
      totalShares: 0,
      topFormat: '—',
      topLanguage: '—',
      byFormat: [],
      byLanguage: [],
    };
  }

  const totalReach = metrics.reduce((sum, m) => sum + m.reach, 0);
  const totalSaves = metrics.reduce((sum, m) => sum + m.saves, 0);
  const totalShares = metrics.reduce((sum, m) => sum + m.shares, 0);
  const avgEngagementRate = Number(
    (metrics.reduce((sum, m) => sum + calculateEngagementRate(m), 0) / metrics.length).toFixed(2)
  );
  const avgSaveRate = Number(
    (metrics.reduce((sum, m) => sum + calculateSaveRate(m), 0) / metrics.length).toFixed(2)
  );

  const byFormat = buildBreakdown(metrics, (m) => m.format);
  const byLanguage = buildBreakdown(metrics, (m) => m.language);

  return {
    totalPosts: metrics.length,
    totalReach,
    avgEngagementRate,
    avgSaveRate,
    totalSaves,
    totalShares,
    topFormat: byFormat[0]?.label || '—',
    topLanguage: byLanguage[0]?.label || '—',
    byFormat,
    byLanguage,
  };
}
