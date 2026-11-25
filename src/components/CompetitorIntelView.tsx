import React, { useState } from 'react';
import { ArrowUpRight, Clapperboard, Languages, Loader2, SearchCode } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { analyzeCompetitorApi } from '../services/studioApi';
import { validateExternalHttpUrl } from '../utils/urlSafety';

export const CompetitorIntelView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    competitors,
    permissions,
    isDemoMode,
    saveCompetitorReport,
    launchFromCalendarSlot,
    notify,
  } = useStudio();

  const [competitorName, setCompetitorName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitorName.trim()) {
      setErrorMsg('Competitor name is required.');
      return;
    }
    if (!sourceUrl.trim() && !pastedContent.trim()) {
      setErrorMsg('Provide either a public competitor URL or pasted post copy/transcript.');
      return;
    }
    if (sourceUrl.trim()) {
      const check = validateExternalHttpUrl(sourceUrl.trim());
      if (!check.valid) {
        setErrorMsg(check.error || 'Please provide a valid public http(s) URL.');
        return;
      }
    }

    setErrorMsg('');
    setAnalyzing(true);
    try {
      const result = await analyzeCompetitorApi(
        {
          brand: brandContext,
          competitorName: competitorName.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          pastedContent: pastedContent.trim() || undefined,
        },
        isDemoMode
      );

      await saveCompetitorReport({
        competitorName: competitorName.trim(),
        sourceUrl: result.sourceUrl || sourceUrl.trim() || undefined,
        summary: result.summary,
        hookPatterns: result.hookPatterns || [],
        contentGaps: result.contentGaps || [],
        counterAngles: result.counterAngles || [],
      });

      setCompetitorName('');
      setSourceUrl('');
      setPastedContent('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Competitor analysis failed.';
      setErrorMsg(msg);
      notify('error', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!activeClient) return null;

  return (
    <div className="space-y-7">
      {/* Competitor Intake Form */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-[#F8FAFC]">
            Competitor Content Intelligence
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Supply a public competitor URL (inspected via Gemini URL Context) or paste competitor
            captions/scripts to extract hook mechanics and counter-angles for {activeClient.name}.
          </p>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="comp-name" className="block text-xs font-medium text-[#CBD5E1]">
                Competitor Brand or Account Name
              </label>
              <input
                id="comp-name"
                type="text"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                disabled={!permissions.canCreateContent}
                placeholder="e.g., Vastra Heritage Collective"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="comp-url" className="block text-xs font-medium text-[#CBD5E1]">
                Supplied Competitor URL (Optional public HTTPS)
              </label>
              <input
                id="comp-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={!permissions.canCreateContent}
                placeholder="https://competitor-brand.com/campaign-page"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="comp-paste" className="block text-xs font-medium text-[#CBD5E1]">
              Or Paste Competitor Captions, Reel Transcripts, or Campaign Copy
            </label>
            <textarea
              id="comp-paste"
              rows={4}
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="Paste 2–5 recent competitor captions, video hooks, or offer copy for deep teardown..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          {errorMsg && <p className="text-xs text-[#F87171]">{errorMsg}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={analyzing || !permissions.canCreateContent}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Competitor...</span>
                </>
              ) : (
                <>
                  <SearchCode className="w-4 h-4" />
                  <span>Run Teardown Analysis</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Saved Reports */}
      {competitors.length === 0 ? (
        <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-12 text-center space-y-2">
          <SearchCode className="w-8 h-8 text-[#64748B] mx-auto" />
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            No competitor teardowns saved for {activeClient.name}
          </h2>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
            Paste a competitor URL or sample posts above to map their hook patterns and build
            brand-aligned counter-angles.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {competitors.map((report) => (
            <article
              key={report.id}
              className="bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                    {report.competitorName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8] mt-0.5">
                    <span className="font-mono">{report.createdAt.slice(0, 10)}</span>
                    {report.sourceUrl && (
                      <>
                        <span aria-hidden="true">·</span>
                        <a
                          href={report.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#E5A024] hover:underline font-mono truncate max-w-sm"
                        >
                          <span>{report.sourceUrl}</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-sm text-[#CBD5E1] leading-relaxed">{report.summary}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/[0.07]">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#F8FAFC]">
                      Observed Hook Patterns
                    </h3>
                    <ul className="space-y-2 text-sm text-[#94A3B8]">
                      {report.hookPatterns.map((p, idx) => (
                        <li key={idx} className="leading-relaxed">
                          — {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#F8FAFC]">
                      White-Space Content Gaps
                    </h3>
                    <ul className="space-y-2 text-sm text-[#94A3B8]">
                      {report.contentGaps.map((g, idx) => (
                        <li key={idx} className="leading-relaxed">
                          — {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Counter-Angle Briefs */}
                <div className="pt-4 border-t border-white/[0.07] space-y-3">
                  <h3 className="text-xs font-semibold text-[#E5A024]">
                    Recommended Counter-Angles for {activeClient.name}
                  </h3>
                  <div className="divide-y divide-white/[0.06] border border-white/[0.07] rounded-lg bg-[#0E131A]">
                    {report.counterAngles.map((ca, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-[#94A3B8]">{ca.format}</div>
                          <div className="text-sm font-semibold text-[#F8FAFC]">{ca.title}</div>
                          <p className="text-xs text-[#94A3B8] leading-relaxed">{ca.angle}</p>
                          <p className="text-xs text-[#E6EDF3]">
                            Suggested Hook: &ldquo;{ca.suggestedHook}&rdquo;
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              launchFromCalendarSlot(
                                'captions',
                                `${ca.title} — ${ca.angle}`,
                                'Competitor Counter'
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.1] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap"
                          >
                            <Languages className="w-3.5 h-3.5 text-[#E5A024]" />
                            <span>Draft Captions</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              launchFromCalendarSlot(
                                'reels',
                                `${ca.title} — Hook: ${ca.suggestedHook}`,
                                'Competitor Counter'
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.1] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap"
                          >
                            <Clapperboard className="w-3.5 h-3.5 text-[#E5A024]" />
                            <span>Draft Reel</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
