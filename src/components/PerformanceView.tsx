import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookmarkPlus, Loader2, Plus, Sparkles, Upload } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generatePerformanceInsightsApi } from '../services/studioApi';
import type { PerformanceMetric } from '../types/studio';
import {
  calculateEngagementRate,
  calculateSaveRate,
  summarizePerformance,
} from '../utils/analytics';
import { parsePerformanceCsv } from '../utils/workflow';

const SAMPLE_CSV_SNIPPET = `post_title,published_date,format,language,pillar,reach,likes,comments,saves,shares,avg_watch_sec
"Uttarayan Handloom Drape Reel",2026-11-24,Reel,Gujarati,Craft Provenance,39500,3120,165,1410,540,20.6`;

export const PerformanceView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    metrics,
    insights,
    permissions,
    isDemoMode,
    addPerformanceMetrics,
    savePerformanceInsight,
    addMemoryItem,
    notify,
  } = useStudio();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Manual Metric form
  const [postTitle, setPostTitle] = useState('');
  const [publishedDate, setPublishedDate] = useState('2026-11-24');
  const [format, setFormat] = useState<PerformanceMetric['format']>('Reel');
  const [language, setLanguage] = useState<PerformanceMetric['language']>('Gujarati');
  const [pillar, setPillar] = useState('Craft Provenance');
  const [reach, setReach] = useState('28000');
  const [likes, setLikes] = useState('1950');
  const [comments, setComments] = useState('110');
  const [saves, setSaves] = useState('860');
  const [shares, setShares] = useState('310');

  // CSV Import state
  const [csvText, setCsvText] = useState(SAMPLE_CSV_SNIPPET);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const summary = useMemo(() => summarizePerformance(metrics), [metrics]);

  if (!activeClient) return null;

  const handleLogMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) {
      notify('error', 'Post title is required.');
      return;
    }
    const reachNum = Number(reach);
    if (!Number.isFinite(reachNum) || reachNum < 0) {
      notify('error', 'Reach must be a valid non-negative number.');
      return;
    }
    await addPerformanceMetrics([
      {
        postTitle: postTitle.trim(),
        publishedDate,
        format,
        language,
        pillar: pillar.trim() || 'General',
        reach: reachNum,
        likes: Math.max(0, Number(likes) || 0),
        comments: Math.max(0, Number(comments) || 0),
        saves: Math.max(0, Number(saves) || 0),
        shares: Math.max(0, Number(shares) || 0),
      },
    ]);
    setPostTitle('');
    setShowAddForm(false);
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePerformanceCsv(csvText);
    setCsvErrors(parsed.errors);
    if (parsed.rows.length === 0) {
      notify('error', parsed.errors[0] || 'No valid metric rows found in CSV.');
      return;
    }
    await addPerformanceMetrics(parsed.rows);
    setShowCsvImport(false);
  };

  const handleGenerateRecommendations = async () => {
    if (metrics.length === 0) {
      notify('error', 'Log or import at least one performance row before running AI analysis.');
      return;
    }
    setAnalyzing(true);
    try {
      const result = await generatePerformanceInsightsApi(
        {
          brand: brandContext,
          metrics,
          summary: summary as unknown as Record<string, unknown>,
        },
        isDemoMode
      );
      await savePerformanceInsight({
        headline: result.headline,
        executiveSummary: result.executiveSummary,
        doubleDown: result.doubleDown || [],
        adjustments: result.adjustments || [],
        nextMonthExperiment: result.nextMonthExperiment || '',
      });
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Performance analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveRecommendationToMemory = async (title: string, detail: string) => {
    await addMemoryItem({
      category: 'winning_pattern',
      title: title.slice(0, 120),
      detail,
      languageScope: 'all',
    });
  };

  return (
    <div className="space-y-7">
      {/* Top KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Reach Analyzed',
            value: summary.totalReach.toLocaleString(),
            sub: `${summary.totalPosts} published posts`,
          },
          {
            label: 'Avg Engagement Rate',
            value: `${summary.avgEngagementRate}%`,
            sub: `${summary.totalShares.toLocaleString()} shares`,
          },
          {
            label: 'Avg Save Rate',
            value: `${summary.avgSaveRate}%`,
            sub: `${summary.totalSaves.toLocaleString()} total saves`,
          },
          {
            label: 'Top Performing Mix',
            value: `${summary.topFormat} / ${summary.topLanguage}`,
            sub: 'Highest engagement yield',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#131922] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between gap-1"
          >
            <div className="text-xs text-[#94A3B8]">{kpi.label}</div>
            <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#F8FAFC] truncate">
              {kpi.value}
            </div>
            <div className="text-xs text-[#64748B]">{kpi.sub}</div>
          </div>
        ))}
      </section>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold text-[#F8FAFC]">
            BrightBean Performance Snapshots &amp; AI Strategy
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Import CSV exports from BrightBean Studio or log post metrics to train next month&apos;s recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {permissions.canCreateContent && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowCsvImport((v) => !v);
                  setShowAddForm(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#E5A024]" />
                <span>Import BrightBean CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((v) => !v);
                  setShowCsvImport(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#E5A024]" />
                <span>Log Post Metric</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateRecommendations}
                disabled={analyzing || metrics.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI Recommendations</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline CSV Import Panel */}
      {showCsvImport && (
        <form
          onSubmit={handleImportCsv}
          className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
              Paste BrightBean Studio Performance CSV
            </h2>
            <button
              type="button"
              onClick={() => setShowCsvImport(false)}
              className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <textarea
            rows={5}
            aria-label="BrightBean CSV data"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
          />
          {csvErrors.length > 0 && (
            <p className="text-xs text-[#F87171]">{csvErrors.join(' ')}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer"
            >
              Import Rows
            </button>
          </div>
        </form>
      )}

      {/* Inline Log Metric Form */}
      {showAddForm && (
        <form
          onSubmit={handleLogMetric}
          className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
              Log Published Post Snapshot
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="pm-title" className="block text-xs text-[#CBD5E1]">
                Post Title
              </label>
              <input
                id="pm-title"
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Patola Craft Behind-the-Scenes Reel"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-date" className="block text-xs text-[#CBD5E1]">
                Published Date
              </label>
              <input
                id="pm-date"
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-format" className="block text-xs text-[#CBD5E1]">
                Format
              </label>
              <select
                id="pm-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as PerformanceMetric['format'])}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              >
                <option value="Reel">Reel</option>
                <option value="Carousel">Carousel</option>
                <option value="Static">Static</option>
                <option value="Story">Story</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-lang" className="block text-xs text-[#CBD5E1]">
                Language
              </label>
              <select
                id="pm-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as PerformanceMetric['language'])}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              >
                <option value="Gujarati">Gujarati</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Multilingual">Multilingual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
            <div className="space-y-1">
              <label htmlFor="pm-pillar" className="block text-xs text-[#CBD5E1]">
                Pillar
              </label>
              <input
                id="pm-pillar"
                type="text"
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-reach" className="block text-xs text-[#CBD5E1]">
                Reach
              </label>
              <input
                id="pm-reach"
                type="number"
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-likes" className="block text-xs text-[#CBD5E1]">
                Likes
              </label>
              <input
                id="pm-likes"
                type="number"
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-comments" className="block text-xs text-[#CBD5E1]">
                Comments
              </label>
              <input
                id="pm-comments"
                type="number"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-saves" className="block text-xs text-[#CBD5E1]">
                Saves
              </label>
              <input
                id="pm-saves"
                type="number"
                value={saves}
                onChange={(e) => setSaves(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pm-shares" className="block text-xs text-[#CBD5E1]">
                Shares
              </label>
              <input
                id="pm-shares"
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer"
            >
              Save Snapshot
            </button>
          </div>
        </form>
      )}

      {/* Charts + Latest AI Strategic Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Engagement &amp; Save Rate by Language (%)
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Comparing Gujarati, Hindi, English, and Multilingual audience yield
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#94A3B8] shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#E5A024]" aria-hidden="true" />
                <span>Engagement %</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#38BDF8]" aria-hidden="true" />
                <span>Save %</span>
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            {summary.byLanguage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.byLanguage} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E131A',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="avgEngagementRate" name="Engagement %" fill="#E5A024" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgSaveRate" name="Save %" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B]">
                Add metrics to render language performance comparisons.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Gemini Performance Diagnosis
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Strategic playbook grounded in {activeClient.name}&apos;s metrics
              </p>
            </div>
            {insights[0] && permissions.canEditBrand && (
              <button
                type="button"
                onClick={() =>
                  handleSaveRecommendationToMemory(
                    insights[0].headline,
                    `${insights[0].executiveSummary} Next Experiment: ${insights[0].nextMonthExperiment}`
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs text-[#E5A024] hover:underline whitespace-nowrap cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save to Memory</span>
              </button>
            )}
          </div>

          {insights.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              Click &ldquo;Generate AI Recommendations&rdquo; above to synthesize strategic actions from these metrics.
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">{insights[0].headline}</h3>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">
                {insights[0].executiveSummary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/[0.07]">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#22C55E]">Double Down</div>
                  <ul className="space-y-1.5 text-xs text-[#94A3B8]">
                    {insights[0].doubleDown.map((item, i) => (
                      <li key={i} className="leading-relaxed">
                        — {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#F59E0B]">Adjust Next Month</div>
                  <ul className="space-y-1.5 text-xs text-[#94A3B8]">
                    {insights[0].adjustments.map((item, i) => (
                      <li key={i} className="leading-relaxed">
                        — {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {insights[0].nextMonthExperiment && (
                <div className="pt-3 border-t border-white/[0.07] text-xs">
                  <span className="font-semibold text-[#E5A024]">Next-Month Experiment: </span>
                  <span className="text-[#CBD5E1]">{insights[0].nextMonthExperiment}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* High-Density Post Performance Table */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            Post-Level Performance Ledger
          </h2>
          <span className="font-mono text-xs tabular-nums text-[#94A3B8]">
            {metrics.length} rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/[0.07] bg-[#0E131A] text-xs text-[#94A3B8]">
              <tr>
                <th className="px-6 py-3 font-medium">Post Title</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Format · Lang</th>
                <th className="px-4 py-3 font-medium text-right">Reach</th>
                <th className="px-4 py-3 font-medium text-right">Saves</th>
                <th className="px-4 py-3 font-medium text-right">Shares</th>
                <th className="px-6 py-3 font-medium text-right">Eng. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {metrics.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-[#F8FAFC]">{m.postTitle}</div>
                    <div className="text-xs text-[#64748B]">{m.pillar}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#94A3B8]">
                    {m.publishedDate}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#CBD5E1]">
                    {m.format} · {m.language}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-right text-[#E6EDF3]">
                    {m.reach.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-right text-[#E6EDF3]">
                    {m.saves.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-right text-[#E6EDF3]">
                    {m.shares.toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs tabular-nums text-right font-semibold text-[#E5A024]">
                    {calculateEngagementRate(m)}% ({calculateSaveRate(m)}% save)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
