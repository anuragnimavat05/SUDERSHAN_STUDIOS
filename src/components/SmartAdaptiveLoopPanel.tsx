import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Brain,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generateAdaptivePlanApi } from '../services/studioApi';
import type { AdaptivePlanResult } from '../types/studio';
import { summarizePerformance } from '../utils/analytics';
import { buildAdaptiveCalendarSlots } from '../utils/dailyPlanner';

interface SmartAdaptiveLoopPanelProps {
  onDraftFromSlot: (topic: string, format: 'Reel' | 'Carousel' | 'Static') => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  winning_pattern: 'Winning Pattern',
  voice_rule: 'Voice Rule',
  content_pillar: 'Content Pillar',
  do_not_use: 'Guardrail / Avoid',
};

export const SmartAdaptiveLoopPanel: React.FC<SmartAdaptiveLoopPanelProps> = ({
  onDraftFromSlot,
}) => {
  const {
    activeClient,
    brandContext,
    assets,
    metrics,
    permissions,
    isDemoMode,
    addMemoryItem,
    saveMonthlyCalendar,
    setActiveView,
    notify,
  } = useStudio();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startDate, setStartDate] = useState(todayIso);
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [planResult, setPlanResult] = useState<AdaptivePlanResult | null>(null);
  const [selectedMemoryIndexes, setSelectedMemoryIndexes] = useState<number[]>([]);

  const perfSummary = useMemo(() => summarizePerformance(metrics), [metrics]);

  if (!activeClient) return null;

  const handleRunSmartLoop = async () => {
    setRunning(true);
    setApplied(false);
    try {
      const data = await generateAdaptivePlanApi(
        {
          brand: brandContext,
          startDate,
          goal: goal.trim() || undefined,
          languages: activeClient.defaultLanguages?.length
            ? activeClient.defaultLanguages
            : ['en', 'hi', 'gu'],
          recentAssets: assets.slice(0, 12).map((a) => ({
            title: a.title,
            format: a.platform,
            pillar: a.pillar,
            status: a.status,
          })),
          metrics,
          performanceSummary: perfSummary as unknown as Record<string, unknown>,
        },
        isDemoMode
      );

      setPlanResult(data);
      setSelectedMemoryIndexes((data.memoryUpdates || []).map((_, idx) => idx));
      notify('success', 'Completed research, proposed Brand Memory updates, and built a new 7-day plan.');
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'Smart adaptive loop failed.'
      );
    } finally {
      setRunning(false);
    }
  };

  const toggleMemorySelection = (idx: number) => {
    setSelectedMemoryIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleApplyUpdatesAndPlan = async () => {
    if (!planResult) return;
    setApplying(true);
    try {
      // 1. Apply selected Brand Memory updates so future AI generations adapt automatically
      const chosenUpdates = planResult.memoryUpdates.filter((_, idx) =>
        selectedMemoryIndexes.includes(idx)
      );
      for (const item of chosenUpdates) {
        await addMemoryItem({
          category: item.category,
          title: item.title,
          detail: item.detail,
          languageScope: item.languageScope,
        });
      }

      // 2. Save the brand-new 7-day plan into Content Calendar
      const mappedSlots = buildAdaptiveCalendarSlots(planResult.slots || [], startDate);
      await saveMonthlyCalendar({
        monthLabel: (planResult.planLabel || `Adaptive 7-Day Plan (${startDate})`).slice(0, 60),
        objective: (planResult.planObjective || planResult.diagnosisSummary).slice(0, 400),
        cadencePerWeek: 7,
        slots: mappedSlots,
      });

      setApplied(true);
      notify(
        'success',
        `Applied ${chosenUpdates.length} Brand Memory update${chosenUpdates.length === 1 ? '' : 's'} and saved your new 7-day plan.`
      );
    } finally {
      setApplying(false);
    }
  };

  const previewSlots = useMemo(
    () => (planResult ? buildAdaptiveCalendarSlots(planResult.slots || [], startDate) : []),
    [planResult, startDate]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left: Closed-Loop Trigger & Context Summary */}
      <section className="xl:col-span-4 bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-4 self-start">
        <div>
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            Post → Research → Update → New Plan
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
            Reviews {activeClient.name}’s published metrics and recent posts, researches fresh niche
            angles, updates Brand Memory as needed, and builds a new 7-day daily plan.
          </p>
        </div>

        {/* Inputs Fed Into Loop */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-[#090C10] border border-white/[0.07]">
            <div className="text-[#64748B]">Tracked Metrics</div>
            <div className="font-mono text-base font-semibold text-[#F8FAFC] tabular-nums mt-0.5">
              {metrics.length} posts
            </div>
            <div className="text-[11px] text-[#94A3B8] truncate">
              Top: {perfSummary.topFormat} · {perfSummary.topLanguage}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#090C10] border border-white/[0.07]">
            <div className="text-[#64748B]">Active Memory</div>
            <div className="font-mono text-base font-semibold text-[#F8FAFC] tabular-nums mt-0.5">
              {brandContext.memory.length} rules
            </div>
            <div className="text-[11px] text-[#94A3B8] truncate">
              {assets.length} recent drafts
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <label htmlFor="adaptive-start-date" className="block text-xs text-[#94A3B8] mb-1.5">
              New 7-Day Plan Start Date
            </label>
            <input
              id="adaptive-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="adaptive-goal" className="block text-xs text-[#94A3B8] mb-1.5">
              Optional Adjustment Goal (e.g., More Leads, Higher Saves)
            </label>
            <textarea
              id="adaptive-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="e.g., Double down on Gujarati Reels and cut low-save static product posts..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          {permissions.canCreateContent ? (
            <button
              type="button"
              disabled={running}
              onClick={handleRunSmartLoop}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Rebuilding Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Smart Loop & Build New Plan</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-[#090C10] border border-white/[0.07] text-xs text-[#94A3B8]">
              Client Reviewers have read-only access to strategy updates.
            </div>
          )}
        </div>
      </section>

      {/* Right: Diagnosis, Proposed Brand Memory Updates & New 7-Day Plan */}
      <section className="xl:col-span-8 space-y-5">
        {!planResult && !running && (
          <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-10 text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-[#E5A024] mx-auto opacity-85" />
            <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
              Closed-Loop AI Strategy Engine
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
              After you post and log metrics, run this Smart Loop to let Sudershan AI diagnose what
              worked, research fresh trends, propose Brand Memory updates, and generate a brand-new
              7-day daily posting plan.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto pt-2 text-left text-xs">
              {[
                ['01', 'Audit Past Posts', 'Checks reach, saves & formats'],
                ['02', 'Research Trends', 'Scans fresh niche angles'],
                ['03', 'Update Memory', 'Saves winning rules to AI'],
                ['04', 'New 7-Day Plan', '1 daily post ready to draft'],
              ].map(([num, title, desc]) => (
                <div
                  key={num}
                  className="p-3 rounded-lg bg-[#090C10] border border-white/[0.07] space-y-1"
                >
                  <div className="font-mono text-[11px] text-[#E5A024]">{num}</div>
                  <div className="font-medium text-[#F8FAFC]">{title}</div>
                  <div className="text-[11px] text-[#64748B] leading-snug">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {running && (
          <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#E5A024] mx-auto" />
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
              Running Smart Research & Strategy Update
            </h2>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Auditing {metrics.length} logged metrics + {assets.length} recent assets, researching
              fresh angles, and updating your 7-day plan for {activeClient.name}.
            </p>
          </div>
        )}

        {planResult && !running && (
          <>
            {/* 1. Diagnosis & Research Changes */}
            <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[#E5A024]">
                  <Globe className="w-4 h-4" />
                  <span>
                    {planResult.researchMode === 'google_search'
                      ? 'Live Web Research & Performance Diagnosis'
                      : 'Adaptive Performance & Trend Diagnosis'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-[#E6EDF3] leading-relaxed">
                {planResult.diagnosisSummary}
              </p>

              {planResult.whatChanged.length > 0 && (
                <ul className="space-y-1.5">
                  {planResult.whatChanged.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[#CBD5E1] flex items-start gap-2 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5A024] mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {planResult.sources.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-2">
                  {planResult.sources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090C10] border border-white/[0.08] hover:border-[#E5A024]/50 text-xs text-[#CBD5E1] max-w-[260px]"
                    >
                      <ExternalLink className="w-3 h-3 text-[#E5A024] shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Proposed Brand Memory Updates */}
            <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#E5A024]" />
                  <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                    Proposed Brand Memory Updates ({selectedMemoryIndexes.length}/
                    {planResult.memoryUpdates.length} selected)
                  </h3>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  Applied rules automatically steer future daily posts
                </span>
              </div>

              <div className="space-y-2.5">
                {planResult.memoryUpdates.map((item, idx) => {
                  const checked = selectedMemoryIndexes.includes(idx);
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#0E131A] border-[#E5A024]/45'
                          : 'bg-[#090C10] border-white/[0.07] opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMemorySelection(idx)}
                        className="mt-1 accent-[#E5A024]"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono text-[#E5A024]">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                          <span aria-hidden="true" className="text-[#475569]">·</span>
                          <span className="text-[#94A3B8] uppercase">{item.languageScope}</span>
                        </div>
                        <div className="text-xs font-semibold text-[#F8FAFC]">{item.title}</div>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">{item.detail}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. New 7-Day Daily Plan + One-Click Apply */}
            <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
                    {planResult.planLabel}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{planResult.planObjective}</p>
                </div>

                {permissions.canCreateContent && (
                  <div className="flex items-center gap-2">
                    {applied ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4ADE80]">
                          <CheckCircle2 className="w-4 h-4" />
                          Memory &amp; 7-Day Plan Applied
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveView('calendar')}
                          className="text-xs font-medium text-[#E5A024] hover:underline cursor-pointer"
                        >
                          Open Calendar →
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={applying}
                        onClick={handleApplyUpdatesAndPlan}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer disabled:opacity-50"
                      >
                        {applying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CalendarPlus className="w-3.5 h-3.5" />
                        )}
                        <span>Apply Memory Updates &amp; Save 7-Day Plan</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="divide-y divide-white/[0.06] border border-white/[0.07] rounded-lg overflow-hidden">
                {previewSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 bg-[#0E131A]/60 hover:bg-[#0E131A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-mono font-semibold text-[#E5A024]">
                          {slot.dateLabel}
                        </span>
                        <span className="text-[#CBD5E1] font-medium">{slot.format}</span>
                        <span aria-hidden="true" className="text-[#475569]">·</span>
                        <span className="text-[#94A3B8]">{slot.pillar}</span>
                        <span aria-hidden="true" className="text-[#475569]">·</span>
                        <span className="font-mono text-[#64748B] uppercase">
                          {slot.languages.join('/')}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[#F8FAFC]">{slot.topic}</div>
                      {slot.hookIdea && (
                        <div className="text-xs text-[#94A3B8]">Hook: {slot.hookIdea}</div>
                      )}
                    </div>

                    {permissions.canCreateContent && (
                      <button
                        type="button"
                        onClick={() =>
                          onDraftFromSlot(
                            slot.topic,
                            slot.format === 'Carousel' || slot.format === 'Static'
                              ? slot.format
                              : 'Reel'
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 shrink-0 cursor-pointer self-start sm:self-center"
                      >
                        <span>Draft Post</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#E5A024]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
