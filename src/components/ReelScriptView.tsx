import React, { useEffect, useState } from 'react';
import { Loader2, Save, Send, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generateReelScriptApi } from '../services/studioApi';
import type { ReelHook, ReelScene } from '../types/studio';

export const ReelScriptView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    permissions,
    isDemoMode,
    draftSeedTopic,
    draftSeedPillar,
    clearDraftSeed,
    saveContentAsset,
    notify,
  } = useStudio();

  const [topic, setTopic] = useState(
    'Behind the double-ikat loom in Patan: why a single 2mm yarn shift resets 40 days of hand-dyeing.'
  );
  const [pillar, setPillar] = useState('Weaver Portraits');
  const [durationSec, setDurationSec] = useState(30);
  const [primaryLanguage, setPrimaryLanguage] = useState('English + Gujarati');
  const [hookStyle, setHookStyle] = useState('Sensory ASMR + Provenance Curiosity');
  const [goal, setGoal] = useState('Maximize 3-second hold rate and trousseau saves');

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [title, setTitle] = useState('Shuttle ASMR — 47 Days on a Double-Ikat Loom');
  const [reelHooks, setReelHooks] = useState<ReelHook[]>([
    {
      angle: 'Sensory Curiosity',
      spokenHook: 'If one single thread shifts by two millimeters, forty days of hand-dyeing vanish.',
      visualCue: 'Extreme macro shot of wooden shuttle gliding across crimson silk warp with raw loom audio.',
      language: 'English',
    },
    {
      angle: 'Gujarati Cultural Pride',
      spokenHook: 'એક દોરો બે મિલીમીટર પણ ખસે, તો ચાલીસ દિવસની મહેનત ફરી શરૂ કરવી પડે.',
      visualCue: 'Close-up of master weaver hands aligning resist knots in warm morning sunlight.',
      language: 'Gujarati',
    },
    {
      angle: 'Myth-Buster Contrast',
      spokenHook: 'Why a real Patan Patola looks identical on both sides—and why powerlooms fail this test.',
      visualCue: 'Slow flip of the fabric showing crisp reverse symmetry.',
      language: 'English',
    },
  ]);

  const [reelScenes, setReelScenes] = useState<ReelScene[]>([
    {
      timecode: '00:00 – 00:03',
      visualDirection: 'Macro 120fps loom shuttle slide, crisp wooden frame acoustics.',
      onScreenText: '47 days. 1 loom. Zero shortcuts.',
      voiceover: 'If one thread shifts by two millimeters, forty days of work resets.',
      audioCue: 'Raw loom ASMR only.',
    },
    {
      timecode: '00:03 – 00:12',
      visualDirection: 'Quick cuts of natural indigo dipping and hand-knotted silk resist bundles.',
      onScreenText: 'Patan Double-Ikat · Master Atelier',
      voiceover: 'Before weaving starts, both warp and weft yarns are hand-dyed to exact geometry.',
      audioCue: 'Warm acoustic tanpura bed at -18dB.',
    },
    {
      timecode: '00:12 – 00:24',
      visualDirection: 'Wide daylight reveal of finished saffron-and-madder border drape.',
      onScreenText: 'Woven for decades, not a weekend.',
      voiceover: 'That patience is why a genuine heirloom Patola stays luminous across generations.',
      audioCue: 'Subtle percussion lift.',
    },
    {
      timecode: '00:24 – 00:30',
      visualDirection: 'Clean closing frame with woven studio label.',
      onScreenText: 'Save for winter trousseau shortlist',
      voiceover: 'Save this story or comment PATOLA for our provenance guide.',
      audioCue: 'Clean fade.',
    },
  ]);
  const [captionEn, setCaptionEn] = useState(
    'Every rhythmic pass of the rosewood shuttle locks 45 days of hand-knotted dyeing into place.'
  );
  const [hashtags, setHashtags] = useState<string[]>(['#PatanPatola', '#HandloomReels', '#GujaratCraft']);
  const [cta, setCta] = useState('Comment PATOLA for our weaver provenance dossier.');

  useEffect(() => {
    if (draftSeedTopic) {
      setTopic(draftSeedTopic);
      if (draftSeedPillar) setPillar(draftSeedPillar);
      clearDraftSeed();
    }
  }, [draftSeedTopic, draftSeedPillar, clearDraftSeed]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg('Please enter a Reel concept or creative angle.');
      return;
    }
    setErrorMsg('');
    setGenerating(true);
    try {
      const result = await generateReelScriptApi(
        {
          brand: brandContext,
          topic: topic.trim(),
          durationSec,
          primaryLanguage,
          hookStyle,
          goal,
        },
        isDemoMode
      );
      setTitle(result.title || topic.slice(0, 80));
      setReelHooks(result.reelHooks || []);
      setReelScenes(result.reelScenes || []);
      setCaptionEn(result.captionEn || '');
      setHashtags(result.hashtags || []);
      setCta(result.cta || goal);
      notify('success', 'Generated Reel hooks and timecoded production script.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reel script generation failed.';
      setErrorMsg(msg);
      notify('error', msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'in_review') => {
    await saveContentAsset({
      title: title.trim() || 'Untitled Reel Script',
      assetType: 'reel_script',
      platform: 'Instagram Reels',
      pillar,
      status,
      languages: primaryLanguage.toLowerCase().includes('gujarati')
        ? ['en', 'gu']
        : primaryLanguage.toLowerCase().includes('hindi')
        ? ['en', 'hi']
        : ['en'],
      captions: { en: captionEn },
      hashtags,
      cta,
      reelHooks,
      reelScenes,
    });
  };

  if (!activeClient) return null;

  return (
    <div className="space-y-7">
      {/* Reel Brief Form */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-[#F8FAFC]">
            Instagram Reel Hooks &amp; Script Lab
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Generate scroll-stopping 0–3s verbal/visual hooks and shot-by-shot production scripts for {activeClient.name}.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6 space-y-1.5">
            <label htmlFor="reel-topic" className="block text-xs font-medium text-[#CBD5E1]">
              Reel Concept / Story
            </label>
            <input
              id="reel-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="reel-dur" className="block text-xs font-medium text-[#CBD5E1]">
              Duration
            </label>
            <select
              id="reel-dur"
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            >
              <option value={15}>15 sec</option>
              <option value={30}>30 sec</option>
              <option value={45}>45 sec</option>
              <option value={60}>60 sec</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="reel-lang" className="block text-xs font-medium text-[#CBD5E1]">
              Spoken Language
            </label>
            <select
              id="reel-lang"
              value={primaryLanguage}
              onChange={(e) => setPrimaryLanguage(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            >
              <option value="English + Gujarati">English + Gujarati</option>
              <option value="Gujarati">Gujarati (ગુજરાતી)</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="English">English</option>
              <option value="Hinglish">Hinglish</option>
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
                  <span>Scripting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <label htmlFor="reel-hook-style" className="block text-xs font-medium text-[#CBD5E1]">
              Hook Psychology
            </label>
            <input
              id="reel-hook-style"
              type="text"
              value={hookStyle}
              onChange={(e) => setHookStyle(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <label htmlFor="reel-goal" className="block text-xs font-medium text-[#CBD5E1]">
              Retention &amp; Conversion Goal
            </label>
            <input
              id="reel-goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            />
          </div>
        </form>

        {errorMsg && <p className="text-xs text-[#F87171]">{errorMsg}</p>}
      </section>

      {/* Output: 0-3s Hooks + Shot-by-Shot Timecoded Script */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              aria-label="Reel script title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent font-display text-lg font-semibold text-[#F8FAFC] focus:outline-none border-b border-transparent focus:border-[#E5A024]"
            />
            <div className="text-xs text-[#94A3B8] mt-0.5">
              {durationSec}s Reel · {primaryLanguage} · {reelHooks.length} Hook Variants · {reelScenes.length} Scenes
            </div>
          </div>

          {permissions.canCreateContent && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSave('draft')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:bg-[#19212D] whitespace-nowrap cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('in_review')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            </div>
          )}
        </div>

        {/* 0-3s Hooks */}
        <div className="p-6 border-b border-white/[0.08] space-y-4">
          <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
            0–3 Second Hook Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reelHooks.map((hook, idx) => (
              <div
                key={`${hook.angle}-${idx}`}
                className="p-4 rounded-lg bg-[#0E131A] border border-white/[0.07] space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span className="text-[#E5A024] font-medium">{hook.angle}</span>
                  <span>{hook.language}</span>
                </div>
                <p className="text-sm font-medium text-[#F8FAFC] leading-relaxed">
                  &ldquo;{hook.spokenHook}&rdquo;
                </p>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Visual: {hook.visualCue}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Timecoded Script Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/[0.08] bg-[#0E131A] text-xs text-[#94A3B8]">
              <tr>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Timecode</th>
                <th className="px-6 py-3 font-medium">Visual &amp; Camera Direction</th>
                <th className="px-6 py-3 font-medium">On-Screen Text</th>
                <th className="px-6 py-3 font-medium">Spoken Voiceover</th>
                <th className="px-6 py-3 font-medium">Audio / Pacing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {reelScenes.map((scene, idx) => (
                <tr key={`${scene.timecode}-${idx}`} className="align-top hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-mono text-xs tabular-nums text-[#E5A024] whitespace-nowrap">
                    {scene.timecode}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#CBD5E1] leading-relaxed">
                    {scene.visualDirection}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-[#F8FAFC] leading-relaxed">
                    {scene.onScreenText}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#E6EDF3] leading-relaxed">
                    {scene.voiceover}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#94A3B8] leading-relaxed">
                    {scene.audioCue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-[#0E131A]/70 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="text-[#CBD5E1]">
            <span className="text-[#94A3B8]">Closing CTA: </span>
            {cta}
          </div>
          <div className="font-mono text-[#E5A024]">{hashtags.join(' ')}</div>
        </div>
      </section>
    </div>
  );
};
