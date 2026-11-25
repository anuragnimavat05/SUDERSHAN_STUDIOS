import React, { useMemo, useState } from 'react';
import { CalendarDays, Clapperboard, Languages, Loader2, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generateMonthlyCalendarApi } from '../services/studioApi';
import type { CalendarSlot } from '../types/studio';

export const CalendarStudioView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    calendars,
    permissions,
    isDemoMode,
    saveMonthlyCalendar,
    saveContentAsset,
    launchFromCalendarSlot,
    notify,
  } = useStudio();

  const [monthLabel, setMonthLabel] = useState('January 2027');
  const [objective, setObjective] = useState(
    'Build Uttarayan / Makar Sankranti seasonal momentum and increase save-worthy educational Reels.'
  );
  const [cadencePerWeek, setCadencePerWeek] = useState(4);
  const [focusPillars, setFocusPillars] = useState('Craft Provenance, Festive Gifting, Community Proof');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['en', 'hi', 'gu']);
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState('');

  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>('All');

  const activeCalendar = useMemo(() => {
    if (calendars.length === 0) return null;
    return calendars.find((c) => c.id === activeCalendarId) || calendars[0];
  }, [calendars, activeCalendarId]);

  const visibleSlots = useMemo(() => {
    if (!activeCalendar) return [];
    const sorted = [...activeCalendar.slots].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
    if (formatFilter === 'All') return sorted;
    return sorted.filter((s) => s.format === formatFilter);
  }, [activeCalendar, formatFilter]);

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((l) => l !== code)
          : prev
        : [...prev, code]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthLabel.trim() || !objective.trim()) {
      setFormError('Month label and campaign objective are required.');
      return;
    }
    setFormError('');
    setGenerating(true);
    try {
      const result = await generateMonthlyCalendarApi(
        {
          brand: brandContext,
          monthLabel: monthLabel.trim(),
          objective: objective.trim(),
          cadencePerWeek,
          focusPillars,
          languages: selectedLangs,
        },
        isDemoMode
      );

      const slots: CalendarSlot[] = (result.slots || []).map((s, idx) => ({
        ...s,
        id: `slot-${Date.now()}-${idx}`,
      }));

      await saveMonthlyCalendar({
        monthLabel: monthLabel.trim(),
        objective: objective.trim(),
        cadencePerWeek,
        slots,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Calendar generation failed.');
      notify('error', err instanceof Error ? err.message : 'Calendar generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendBriefToApproval = async (slot: CalendarSlot) => {
    await saveContentAsset({
      title: `${slot.dateLabel} — ${slot.topic}`,
      assetType: 'calendar_brief',
      platform: slot.format === 'Reel' ? 'Instagram Reels' : 'Instagram',
      pillar: slot.pillar,
      status: 'draft',
      languages: slot.languages.length ? slot.languages : ['en'],
      captions: {
        en: `Creative Brief (${slot.format})\nHook Idea: ${slot.hookIdea}\nCTA Goal: ${slot.ctaGoal}`,
      },
      cta: slot.ctaGoal,
    });
  };

  if (!activeClient) return null;

  return (
    <div className="space-y-7">
      {/* Generator Panel */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-[#F8FAFC]">
              AI Monthly Content Calendar
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1">
              Grounded in {brandContext.memory.length} Brand Memory rules for {activeClient.name}.
              Draft slots directly into Captions or Reels—scheduling stays in BrightBean Studio.
            </p>
          </div>
          {calendars.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="saved-cal-select" className="text-xs text-[#94A3B8]">
                Saved Month:
              </label>
              <select
                id="saved-cal-select"
                value={activeCalendar?.id || ''}
                onChange={(e) => setActiveCalendarId(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-md bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.monthLabel} ({c.slots.length} slots)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="cal-month" className="block text-xs font-medium text-[#CBD5E1]">
              Target Month
            </label>
            <input
              id="cal-month"
              type="text"
              value={monthLabel}
              onChange={(e) => setMonthLabel(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="January 2027"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <label htmlFor="cal-objective" className="block text-xs font-medium text-[#CBD5E1]">
              Monthly Campaign Objective
            </label>
            <input
              id="cal-objective"
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="Drive festive inquiries, saves, or product launches"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="cal-cadence" className="block text-xs font-medium text-[#CBD5E1]">
              Posts / Week
            </label>
            <select
              id="cal-cadence"
              value={cadencePerWeek}
              onChange={(e) => setCadencePerWeek(Number(e.target.value))}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} / week
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={generating || !permissions.canCreateContent}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-7 space-y-1.5">
            <label htmlFor="cal-pillars" className="block text-xs font-medium text-[#CBD5E1]">
              Focus Content Pillars
            </label>
            <input
              id="cal-pillars"
              type="text"
              value={focusPillars}
              onChange={(e) => setFocusPillars(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <span className="block text-xs font-medium text-[#CBD5E1]">Target Languages</span>
            <div className="flex items-center gap-1.5 p-1 bg-[#090C10] border border-white/[0.1] rounded-lg">
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'Hindi' },
                { code: 'gu', label: 'Gujarati' },
              ].map((lang) => {
                const active = selectedLangs.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLang(lang.code)}
                    disabled={!permissions.canCreateContent}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E5A024] text-[#090C10] font-semibold'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {formError && <p className="text-xs text-[#F87171]">{formError}</p>}
      </section>

      {/* Active Calendar View */}
      {generating ? (
        <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-3">
          <div className="h-5 w-48 bg-white/[0.06] rounded animate-pulse" />
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 w-full bg-white/[0.04] rounded animate-pulse" />
          ))}
        </div>
      ) : !activeCalendar ? (
        <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-12 text-center space-y-2">
          <CalendarDays className="w-8 h-8 text-[#64748B] mx-auto" />
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            No monthly calendar generated yet
          </h2>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
            Set your target month and objective above to generate a complete, memory-grounded
            content schedule for {activeClient.name}.
          </p>
        </div>
      ) : (
        <section className="bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <span className="font-mono tabular-nums">{activeCalendar.slots.length} planned slots</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{activeCalendar.cadencePerWeek}/week cadence</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC] mt-0.5">
                {activeCalendar.monthLabel} — {activeCalendar.objective}
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#090C10] border border-white/[0.08] rounded-lg">
              {['All', 'Reel', 'Carousel', 'Static', 'Story'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatFilter(fmt)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    formatFilter === fmt
                      ? 'bg-[#19212D] text-[#F8FAFC]'
                      : 'text-[#94A3B8] hover:text-[#E6EDF3]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {visibleSlots.map((slot) => (
              <div
                key={slot.id}
                className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center hover:bg-white/[0.02]"
              >
                <div className="lg:col-span-2">
                  <div className="font-mono text-sm font-semibold tabular-nums text-[#E5A024]">
                    {slot.dateLabel}
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">
                    {slot.format} · {slot.languages.join('/').toUpperCase()}
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-1">
                  <div className="text-xs text-[#94A3B8]">{slot.pillar}</div>
                  <div className="text-sm font-semibold text-[#F8FAFC]">{slot.topic}</div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Hook: {slot.hookIdea} · CTA: {slot.ctaGoal}
                  </p>
                </div>

                <div className="lg:col-span-4 flex flex-wrap items-center lg:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => launchFromCalendarSlot('captions', slot.topic, slot.pillar)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] hover:border-[#E5A024]/60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Languages className="w-3.5 h-3.5 text-[#E5A024]" />
                    <span>Captions</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launchFromCalendarSlot('reels', slot.topic, slot.pillar)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] hover:border-[#E5A024]/60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Clapperboard className="w-3.5 h-3.5 text-[#E5A024]" />
                    <span>Reel Script</span>
                  </button>
                  {permissions.canCreateContent && (
                    <button
                      type="button"
                      onClick={() => handleSendBriefToApproval(slot)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-[#E5A024] hover:bg-[#E5A024]/10 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Save Brief
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
