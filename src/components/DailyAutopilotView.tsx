import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generateDailyAutopilotApi } from '../services/studioApi';
import type { DailyAutopilotResult } from '../types/studio';
import { buildSevenDayCoverage, formatMetaCopyPack } from '../utils/dailyPlanner';
import { SmartAdaptiveLoopPanel } from './SmartAdaptiveLoopPanel';

type FormatPref = 'Auto' | 'Reel' | 'Carousel' | 'Static';

const FORMAT_OPTIONS: Array<{
  id: FormatPref;
  label: string;
  hint: string;
}> = [
  { id: 'Auto', label: 'Auto-Pick', hint: 'Best format for today’s trend' },
  { id: 'Reel', label: 'Instagram Reel', hint: 'Hooks + scene script' },
  { id: 'Carousel', label: 'Carousel', hint: 'Slide-by-slide outline' },
  { id: 'Static', label: 'Static Post', hint: 'Single hero visual + copy' },
];

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'gu', label: 'ગુજરાતી' },
];

export const DailyAutopilotView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    assets,
    permissions,
    isDemoMode,
    saveContentAsset,
    setActiveView,
    notify,
  } = useStudio();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeTab, setActiveTab] = useState<'daily_post' | 'smart_loop'>('daily_post');
  const [targetDate, setTargetDate] = useState(todayIso);
  const [formatPref, setFormatPref] = useState<FormatPref>('Auto');
  const [languages, setLanguages] = useState<string[]>(
    activeClient?.defaultLanguages?.length ? activeClient.defaultLanguages : ['en', 'hi', 'gu']
  );
  const [focusTopic, setFocusTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null);
  const [copiedPack, setCopiedPack] = useState(false);
  const [result, setResult] = useState<DailyAutopilotResult | null>(null);
  const [generatedHistory, setGeneratedHistory] = useState<string[]>([]);

  useEffect(() => {
    if (activeClient?.defaultLanguages?.length) {
      setLanguages(activeClient.defaultLanguages);
    }
    setResult(null);
    setSavedAssetId(null);
  }, [activeClient?.id]);

  const coverage = useMemo(
    () => buildSevenDayCoverage(assets, todayIso),
    [assets, todayIso]
  );

  if (!activeClient) return null;

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((c) => c !== code) : prev;
      }
      return [...prev, code];
    });
  };

  const runDailyResearch = async (extraAvoidTitle?: string) => {
    setGenerating(true);
    setSavedAssetId(null);
    setCopiedPack(false);
    try {
      const recentTopics = [
        ...assets.slice(0, 6).map((a) => a.title),
        ...generatedHistory,
        ...(extraAvoidTitle ? [extraAvoidTitle] : []),
      ].slice(0, 10);

      const data = await generateDailyAutopilotApi(
        {
          brand: brandContext,
          targetDate,
          formatPreference: formatPref,
          languages,
          focusTopic: focusTopic.trim() || undefined,
          recentTopics,
        },
        isDemoMode
      );

      setResult(data);
      if (data.title) {
        setGeneratedHistory((prev) => [data.title, ...prev].slice(0, 8));
      }
      notify('success', `Researched live trends and prepared your ${data.chosenFormat} for ${data.dateLabel}.`);
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'Failed to run daily research and generation.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'in_review') => {
    if (!result) return;
    setSaving(true);
    try {
      const isReel = result.chosenFormat === 'Reel';
      const isCarousel = result.chosenFormat === 'Carousel';
      const assetId = await saveContentAsset({
        title: result.title,
        assetType: isReel ? 'reel_script' : 'caption_pack',
        platform: isReel
          ? 'Instagram Reels'
          : isCarousel
          ? 'Instagram Carousel'
          : 'Instagram',
        pillar: result.pillar || 'Daily Autopilot',
        status,
        languages,
        captions: result.captions,
        hashtags: result.hashtags,
        cta: result.cta,
        reelHooks: isReel ? result.reelHooks : undefined,
        reelScenes: isReel ? result.reelScenes : undefined,
        repurposedOutputs:
          isCarousel && result.carouselSlides?.length
            ? { instagramCarousel: result.carouselSlides }
            : undefined,
        reviewerNote: `Daily Research (${result.dateLabel} · ${result.bestPostingTime}): ${result.whyToday}`,
      });
      setSavedAssetId(assetId || 'saved');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMetaPack = async () => {
    if (!result) return;
    try {
      const text = formatMetaCopyPack(result, activeClient.name);
      await navigator.clipboard.writeText(text);
      setCopiedPack(true);
      notify('success', 'Copied ready-to-post pack for Meta Business Suite / BrightBean.');
      setTimeout(() => setCopiedPack(false), 2500);
    } catch {
      notify('error', 'Clipboard copy was blocked by the browser.');
    }
  };

  const formatBadgeIcon = (fmt: DailyAutopilotResult['chosenFormat']) => {
    if (fmt === 'Reel') return <Clapperboard className="w-3.5 h-3.5 text-[#E5A024]" />;
    if (fmt === 'Carousel') return <Layers className="w-3.5 h-3.5 text-[#E5A024]" />;
    return <ImageIcon className="w-3.5 h-3.5 text-[#E5A024]" />;
  };

  return (
    <div className="space-y-5">
      {/* Header + 7-Day Daily Cadence Strip */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#F8FAFC]">
              Daily Research & One-Post-Per-Day Autopilot
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-2xl">
              Researches live web trends for <span className="text-[#E6EDF3] font-medium">{activeClient.name}</span>,
              checks your Brand Memory, and builds one complete Instagram Reel, Carousel, or Static
              post ready for approval and Meta Business Suite / BrightBean upload.
            </p>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div>
              <div className="text-[11px] text-[#64748B]">7-Day Coverage</div>
              <div className="font-mono text-xl font-semibold text-[#F8FAFC] tabular-nums">
                {coverage.coveredDays}/7
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">Daily Streak</div>
              <div className="font-mono text-xl font-semibold text-[#E5A024] tabular-nums">
                {coverage.streakDays}d
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">Today</div>
              <div
                className={`text-sm font-medium mt-0.5 ${
                  coverage.todayCovered ? 'text-[#4ADE80]' : 'text-[#E5A024]'
                }`}
              >
                {coverage.todayCovered ? 'Covered' : 'Open Slot'}
              </div>
            </div>
          </div>
        </div>

        {/* 7-day rolling cadence row */}
        <div className="grid grid-cols-7 gap-2" aria-label="Last 7 days posting cadence">
          {coverage.days.map((day) => (
            <div
              key={day.dateIso}
              title={day.latestTitle ? `${day.dateIso}: ${day.latestTitle}` : `${day.dateIso}: No asset yet`}
              className={`rounded-lg px-2.5 py-2 border text-center transition-colors ${
                day.isToday
                  ? day.count > 0
                    ? 'bg-[#4ADE80]/10 border-[#4ADE80]/40'
                    : 'bg-[#E5A024]/10 border-[#E5A024]/45'
                  : day.count > 0
                  ? 'bg-[#0E131A] border-white/[0.12]'
                  : 'bg-[#090C10] border-white/[0.05]'
              }`}
            >
              <div className="text-[10px] font-medium text-[#94A3B8]">{day.weekday}</div>
              <div className="font-mono text-sm font-semibold text-[#F8FAFC] tabular-nums">
                {day.dayNum}
              </div>
              <div className="mt-1 flex items-center justify-center">
                {day.count > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" aria-label={`${day.count} post ready`} />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      day.isToday ? 'bg-[#E5A024]' : 'bg-white/[0.15]'
                    }`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Mode Tabs */}
        <div
          role="tablist"
          aria-label="Daily Autopilot workflow modes"
          className="flex items-center gap-2 border-t border-white/[0.07] pt-3.5 max-w-full overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'daily_post'}
            onClick={() => setActiveTab('daily_post')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'daily_post'
                ? 'bg-[#E5A024]/15 text-[#F8FAFC] border border-[#E5A024]/50'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
            }`}
          >
            Today’s Daily Post (1 / Day)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smart_loop'}
            onClick={() => setActiveTab('smart_loop')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'smart_loop'
                ? 'bg-[#E5A024]/15 text-[#F8FAFC] border border-[#E5A024]/50'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
            }`}
          >
            Smart Loop (Research → Update → New Plan)
          </button>
        </div>
      </section>

      {activeTab === 'smart_loop' ? (
        <SmartAdaptiveLoopPanel
          onDraftFromSlot={(topic, fmt) => {
            setFocusTopic(topic);
            setFormatPref(fmt);
            setActiveTab('daily_post');
            notify('info', `Loaded "${topic}" into Today’s Daily Post generator.`);
          }}
        />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Daily Brief Controls */}
        <section className="xl:col-span-4 bg-[#131922] border border-white/[0.08] rounded-xl p-5 space-y-4 self-start">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
              Configure Today’s Post
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Leave topic blank to let Gemini autonomously research today’s strongest trend for{' '}
              {activeClient.industry}.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="daily-date" className="block text-xs text-[#94A3B8] mb-1.5">
                Target Date
              </label>
              <input
                id="daily-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={!permissions.canCreateContent}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            <div>
              <span className="block text-xs text-[#94A3B8] mb-1.5">Format Preference</span>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((opt) => {
                  const active = formatPref === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!permissions.canCreateContent}
                      onClick={() => setFormatPref(opt.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                        active
                          ? 'bg-[#E5A024]/14 border-[#E5A024]/60 text-[#F8FAFC]'
                          : 'bg-[#090C10] border-white/[0.08] text-[#94A3B8] hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs text-[#94A3B8] mb-1.5">Caption Languages</span>
              <div className="grid grid-cols-3 gap-2">
                {LANG_OPTIONS.map((lang) => {
                  const selected = languages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      disabled={!permissions.canCreateContent}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                        selected
                          ? 'bg-[#E5A024]/14 border-[#E5A024]/60 text-[#F8FAFC]'
                          : 'bg-[#090C10] border-white/[0.08] text-[#94A3B8] hover:text-[#E6EDF3]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="daily-focus" className="block text-xs text-[#94A3B8] mb-1.5">
                Optional Focus Topic or Product (Leave Blank for Auto-Research)
              </label>
              <textarea
                id="daily-focus"
                rows={2}
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                disabled={!permissions.canCreateContent}
                placeholder="e.g., Instagram algorithm shift for local businesses, or festive styling tips..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            {permissions.canCreateContent ? (
              <button
                type="button"
                disabled={generating}
                onClick={() => runDailyResearch()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Researching & Building Post...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Research & Generate Today’s Post</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-[#090C10] border border-white/[0.07] text-xs text-[#94A3B8]">
                Client Reviewers have read-only access here. Switch to Approvals to review daily drafts.
              </div>
            )}
          </div>
        </section>

        {/* Right: Research Findings + Ready-to-Post Daily Pack */}
        <section className="xl:col-span-8 space-y-5">
          {!result && !generating && (
            <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
              <Globe className="w-8 h-8 text-[#E5A024] mx-auto opacity-85" />
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                Ready for Today’s Live Trend Research
              </h2>
              <p className="text-sm text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
                Click <span className="text-[#E6EDF3] font-medium">Research & Generate Today’s Post</span> to
                scan live web trends with Google Search, avoid repeating your recent posts, and
                output one complete Reel, Carousel, or Static post tailored to {activeClient.name}.
              </p>
            </div>
          )}

          {generating && (
            <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#E5A024] mx-auto" />
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Running Live Web Research & Writing Today’s Pack
              </h2>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                Step 1: Grounding in current industry trends via Google Search · Step 2: Writing
                format-matched creative, script/slides, and native captions in your Brand Memory voice.
              </p>
            </div>
          )}

          {result && !generating && (
            <>
              {/* Live Research Brief Card */}
              <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#E5A024]">
                    <Globe className="w-4 h-4" />
                    <span>
                      {result.researchMode === 'google_search'
                        ? `Live Web Research Brief · ${result.dateLabel}`
                        : `Daily Research Brief · ${result.dateLabel}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                    <span className="inline-flex items-center gap-1.5 text-[#F8FAFC] font-medium">
                      {formatBadgeIcon(result.chosenFormat)}
                      {result.chosenFormat}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                      {result.bestPostingTime}
                    </span>
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-xl font-bold text-[#F8FAFC]">{result.title}</h2>
                  <p className="text-sm text-[#CBD5E1] mt-1.5 leading-relaxed">{result.whyToday}</p>
                </div>

                {result.researchHighlights.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-medium text-[#64748B]">
                      Key Research Findings
                    </div>
                    <ul className="space-y-1.5">
                      {result.researchHighlights.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-[#CBD5E1] flex items-start gap-2 leading-relaxed"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E5A024] mt-1.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.sources.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="text-[11px] font-medium text-[#64748B]">
                      Verified Web Sources
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.sources.map((src) => (
                        <a
                          key={src.url}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090C10] border border-white/[0.08] hover:border-[#E5A024]/50 text-xs text-[#CBD5E1] hover:text-[#F8FAFC] max-w-[260px]"
                        >
                          <ExternalLink className="w-3 h-3 text-[#E5A024] shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Format-Specific Production Blueprint (Reel vs Carousel vs Static) */}
              <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
                      {result.chosenFormat === 'Reel'
                        ? 'Reel Hooks & Timecoded Script'
                        : result.chosenFormat === 'Carousel'
                        ? 'Carousel Slide-by-Slide Plan'
                        : 'Static Visual Direction'}
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Pillar: {result.pillar}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMetaPack}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer"
                    >
                      {copiedPack ? (
                        <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#E5A024]" />
                      )}
                      <span>{copiedPack ? 'Copied Pack' : 'Copy Meta / BrightBean Pack'}</span>
                    </button>
                    {permissions.canCreateContent && (
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => runDailyResearch(result.title)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Another Angle</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Visual / Design Brief */}
                <div className="p-3.5 rounded-lg bg-[#090C10] border border-white/[0.06]">
                  <div className="text-[11px] font-medium text-[#64748B] mb-1">
                    Visual & Art Direction
                  </div>
                  <p className="text-xs text-[#CBD5E1] leading-relaxed">{result.visualBrief}</p>
                </div>

                {/* Carousel Slides */}
                {result.chosenFormat === 'Carousel' &&
                  result.carouselSlides &&
                  result.carouselSlides.length > 0 && (
                    <div className="space-y-2">
                      {result.carouselSlides.map((slide, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-[#0E131A] border border-white/[0.06] flex items-start gap-3"
                        >
                          <span className="font-mono text-[11px] text-[#E5A024] shrink-0 pt-0.5">
                            0{idx + 1}
                          </span>
                          <p className="text-xs text-[#E6EDF3] leading-relaxed">{slide}</p>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Reel Hooks & Scenes */}
                {result.chosenFormat === 'Reel' && (
                  <div className="space-y-4">
                    {result.reelHooks && result.reelHooks.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {result.reelHooks.map((hook, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-lg bg-[#0E131A] border border-white/[0.07] space-y-1.5"
                          >
                            <div className="text-[11px] font-mono text-[#E5A024]">
                              {hook.angle} · {hook.language.toUpperCase()}
                            </div>
                            <p className="text-xs font-medium text-[#F8FAFC] leading-relaxed">
                              “{hook.spokenHook}”
                            </p>
                            <p className="text-[11px] text-[#94A3B8] leading-snug">
                              Visual: {hook.visualCue}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.reelScenes && result.reelScenes.length > 0 && (
                      <div className="overflow-x-auto border border-white/[0.07] rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#0E131A] text-[#64748B] border-b border-white/[0.07]">
                            <tr>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Time</th>
                              <th className="px-3 py-2 font-medium">Visual</th>
                              <th className="px-3 py-2 font-medium">On-Screen Text</th>
                              <th className="px-3 py-2 font-medium">Voiceover</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {result.reelScenes.map((scene, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="px-3 py-2.5 font-mono text-[#E5A024] whitespace-nowrap">
                                  {scene.timecode}
                                </td>
                                <td className="px-3 py-2.5 text-[#CBD5E1]">{scene.visualDirection}</td>
                                <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">
                                  {scene.onScreenText}
                                </td>
                                <td className="px-3 py-2.5 text-[#CBD5E1]">{scene.voiceover}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Captions (EN / HI / GU) */}
                <div className="space-y-3 pt-2 border-t border-white/[0.07]">
                  <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                    Ready-to-Publish Captions
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {result.captions.en?.trim() && (
                      <div className="p-3.5 rounded-lg bg-[#090C10] border border-white/[0.07] space-y-1">
                        <div className="text-[11px] font-mono text-[#E5A024]">ENGLISH</div>
                        <p className="text-sm text-[#E6EDF3] whitespace-pre-wrap leading-relaxed">
                          {result.captions.en}
                        </p>
                      </div>
                    )}
                    {result.captions.hi?.trim() && (
                      <div className="p-3.5 rounded-lg bg-[#090C10] border border-white/[0.07] space-y-1">
                        <div className="text-[11px] font-mono text-[#E5A024]">हिन्दी (HINDI)</div>
                        <p className="font-hi text-sm text-[#E6EDF3] whitespace-pre-wrap leading-relaxed">
                          {result.captions.hi}
                        </p>
                      </div>
                    )}
                    {result.captions.gu?.trim() && (
                      <div className="p-3.5 rounded-lg bg-[#090C10] border border-white/[0.07] space-y-1">
                        <div className="text-[11px] font-mono text-[#E5A024]">ગુજરાતી (GUJARATI)</div>
                        <p className="font-gu text-sm text-[#E6EDF3] whitespace-pre-wrap leading-relaxed">
                          {result.captions.gu}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                    <div className="text-[#94A3B8]">
                      <span className="text-[#64748B]">CTA: </span>
                      <span className="text-[#E6EDF3]">{result.cta}</span>
                    </div>
                    {result.hashtags.length > 0 && (
                      <div className="font-mono text-[11px] text-[#E5A024] break-words">
                        {result.hashtags.join(' ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Save to Pipeline Bar */}
                {permissions.canCreateContent && (
                  <div className="pt-4 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                    {savedAssetId ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4ADE80]">
                          <CheckCircle2 className="w-4 h-4" />
                          Saved to today’s cadence & Approval Pipeline
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveView('approvals')}
                          className="text-xs font-medium text-[#E5A024] hover:underline cursor-pointer"
                        >
                          Open Approvals & Export →
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSave('draft')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5 text-[#E5A024]" />
                          <span>Save Draft</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSave('in_review')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Save & Submit for Review</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  );
};
