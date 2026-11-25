import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Save, Send, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { generateMultilingualCaptionsApi } from '../services/studioApi';
import type { CaptionVariants } from '../types/studio';

export const CaptionStudioView: React.FC = () => {
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
    'Unveiling our hand-knotted Patan Patola winter trousseau collection woven over 45 days.'
  );
  const [pillar, setPillar] = useState('Craft Provenance');
  const [platform, setPlatform] = useState('Instagram');
  const [tone, setTone] = useState('Editorial Atelier Authority');
  const [ctaGoal, setCtaGoal] = useState('Save for winter trousseau shortlist or DM for private viewing');
  const [languages, setLanguages] = useState<string[]>(['en', 'hi', 'gu']);
  const [includeRomanized, setIncludeRomanized] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [title, setTitle] = useState('Patan Patola Winter Trousseau Reveal');
  const [captions, setCaptions] = useState<CaptionVariants>({
    en: 'Before a single thread touches the loom in Patan, forty-five days are spent tying geometric resists by hand. Each double-ikat weave carries the patience of a family craft that refuses shortcuts.\n\nSave this numbered Winter Atelier Release for your heirloom shortlist.',
    hi: 'पाटन के करघे पर एक भी धागा चढ़ने से पहले, 45 दिन हाथों से सूत बांधने और प्राकृतिक रंगों में डुबोने में बीतते हैं। हर डबल-इकत पटोला सिर्फ वस्त्र नहीं, पीढ़ियों की धरोहर है।\n\nहमारे विंटर एटेलियर संग्रह के लिए यह पोस्ट सेव करें।',
    gu: 'પાટણના સાળ પર એક પણ દોરો ચડે તે પહેલાં, 45 દિવસ સુધી કારીગરો હાથથી બાંધણી અને કુદરતી રંગકામની સાધના કરે છે. દરેક ડબલ-ઇકત પટોળું માત્ર વસ્ત્ર નથી, પણ ગુજરાતનો જીવંત વારસો છે.\n\nઅમારા વિન્ટર એટેલિયર કલેક્શનની મર્યાદિત કૃતિઓ માટે આ પોસ્ટ સેવ કરો.',
  });
  const [hashtags, setHashtags] = useState<string[]>([
    '#PatanPatola',
    '#GujaratHandloom',
    '#HeirloomWeaves',
    '#IndianCraft',
  ]);
  const [cta, setCta] = useState('Save for winter trousseau shortlist or DM for viewing.');
  const [culturalNote, setCulturalNote] = useState(
    'Gujarati copy uses idiomatic craft phrasing ("સાધના", "જીવંત વારસો") instead of direct English translation.'
  );

  useEffect(() => {
    if (draftSeedTopic) {
      setTopic(draftSeedTopic);
      if (draftSeedPillar) setPillar(draftSeedPillar);
      clearDraftSeed();
    }
  }, [draftSeedTopic, draftSeedPillar, clearDraftSeed]);

  const toggleLanguage = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((l) => l !== code)
          : prev
        : [...prev, code]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg('Please enter a post topic or creative brief.');
      return;
    }
    setErrorMsg('');
    setGenerating(true);
    try {
      const result = await generateMultilingualCaptionsApi(
        {
          brand: brandContext,
          topic: topic.trim(),
          platform,
          tone,
          ctaGoal,
          languages,
          includeRomanized,
        },
        isDemoMode
      );
      setTitle(result.title || topic.slice(0, 80));
      setCaptions(result.captions || {});
      setHashtags(result.hashtags || []);
      setCta(result.cta || ctaGoal);
      setCulturalNote(result.culturalNote || '');
      notify('success', 'Generated native Gujarati, Hindi, and English captions.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Caption generation failed.';
      setErrorMsg(msg);
      notify('error', msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (key: string, text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(`${text}\n\n${hashtags.join(' ')}`);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      notify('error', 'Clipboard access unavailable in this browser context.');
    }
  };

  const handleSave = async (status: 'draft' | 'in_review') => {
    if (!title.trim()) {
      setErrorMsg('Asset title is required before saving.');
      return;
    }
    await saveContentAsset({
      title: title.trim(),
      assetType: 'caption_pack',
      platform,
      pillar,
      status,
      languages,
      captions,
      hashtags,
      cta,
    });
  };

  if (!activeClient) return null;

  const languageCards: Array<{
    key: keyof CaptionVariants;
    label: string;
    scriptNote: string;
    visible: boolean;
  }> = [
    { key: 'en', label: 'English', scriptNote: 'Editorial Latin', visible: languages.includes('en') },
    { key: 'hi', label: 'Hindi · हिन्दी', scriptNote: 'Native Devanagari', visible: languages.includes('hi') },
    { key: 'gu', label: 'Gujarati · ગુજરાતી', scriptNote: 'Native Gujarati Script', visible: languages.includes('gu') },
    {
      key: 'hinglish',
      label: 'Hinglish',
      scriptNote: 'Romanized Conversational',
      visible: includeRomanized && Boolean(captions.hinglish),
    },
    {
      key: 'gujlish',
      label: 'Gujlish',
      scriptNote: 'Romanized Gujarati',
      visible: includeRomanized && Boolean(captions.gujlish),
    },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Brief Composer */}
      <section className="xl:col-span-4 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div>
          <h1 className="font-display text-lg font-bold text-[#F8FAFC]">
            Trilingual Caption Brief
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Generate culturally fluent Gujarati, Hindi, and English captions using {activeClient.name}&apos;s Brand Memory.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cap-topic" className="block text-xs font-medium text-[#CBD5E1]">
              Post Topic or Creative Brief
            </label>
            <textarea
              id="cap-topic"
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="Describe the visual, product, story, or festival angle..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="cap-platform" className="block text-xs font-medium text-[#CBD5E1]">
                Platform
              </label>
              <select
                id="cap-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={!permissions.canCreateContent}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
              >
                <option value="Instagram">Instagram Feed</option>
                <option value="Instagram Carousel">Instagram Carousel</option>
                <option value="Instagram Reels">Instagram Reels</option>
                <option value="LinkedIn">LinkedIn</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cap-pillar" className="block text-xs font-medium text-[#CBD5E1]">
                Content Pillar
              </label>
              <input
                id="cap-pillar"
                type="text"
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                disabled={!permissions.canCreateContent}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cap-tone" className="block text-xs font-medium text-[#CBD5E1]">
              Tone Direction
            </label>
            <input
              id="cap-tone"
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cap-cta" className="block text-xs font-medium text-[#CBD5E1]">
              CTA Objective
            </label>
            <input
              id="cap-cta"
              type="text"
              value={ctaGoal}
              onChange={(e) => setCtaGoal(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#CBD5E1]">Output Languages</span>
            <div className="flex items-center gap-1.5 p-1 bg-[#090C10] border border-white/[0.1] rounded-lg">
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिन्दी' },
                { code: 'gu', label: 'ગુજરાતી' },
              ].map((lang) => {
                const active = languages.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
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

            <label className="flex items-center gap-2 text-xs text-[#94A3B8] pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRomanized}
                onChange={(e) => setIncludeRomanized(e.target.checked)}
                disabled={!permissions.canCreateContent}
                className="rounded border-white/20 bg-[#090C10] accent-[#E5A024]"
              />
              <span>Also generate Romanized Hinglish &amp; Gujlish variants</span>
            </label>
          </div>

          {errorMsg && <p className="text-xs text-[#F87171]">{errorMsg}</p>}

          <button
            type="submit"
            disabled={generating || !permissions.canCreateContent}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Captions...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Multilingual Pack</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Right Editable Output Panels */}
      <section className="xl:col-span-8 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="cap-asset-title" className="sr-only">
              Asset Title
            </label>
            <input
              id="cap-asset-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent font-display text-base font-semibold text-[#F8FAFC] focus:outline-none border-b border-transparent focus:border-[#E5A024] pb-0.5"
            />
            <div className="text-xs text-[#94A3B8] mt-0.5">
              {platform} · {pillar} · Editable before saving to Approval Pipeline
            </div>
          </div>

          {permissions.canCreateContent && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSave('draft')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:bg-[#19212D] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('in_review')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-white/[0.07]">
          {languageCards
            .filter((card) => card.visible)
            .map((card) => (
              <div key={card.key} className="p-6 space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#F8FAFC]">{card.label}</span>
                    <span aria-hidden="true" className="text-[#475569]">·</span>
                    <span className="text-[#94A3B8]">{card.scriptNote}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(card.key, captions[card.key])}
                    className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#E5A024] transition-colors cursor-pointer"
                  >
                    {copiedKey === card.key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span className="text-[#22C55E]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy with Hashtags</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={4}
                  aria-label={`${card.label} caption`}
                  value={captions[card.key] || ''}
                  onChange={(e) =>
                    setCaptions((prev) => ({ ...prev, [card.key]: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm leading-relaxed rounded-lg bg-[#090C10] border border-white/[0.09] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024]"
                />
              </div>
            ))}

          {/* Hashtags & Cultural Calibration */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0E131A]/60">
            <div className="space-y-1.5">
              <label htmlFor="cap-hashtags" className="block text-xs font-medium text-[#CBD5E1]">
                Hashtag Cluster
              </label>
              <input
                id="cap-hashtags"
                type="text"
                value={hashtags.join(' ')}
                onChange={(e) =>
                  setHashtags(
                    e.target.value
                      .split(/\s+/)
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#090C10] border border-white/[0.09] text-[#E5A024]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-[#CBD5E1]">
                Cultural Adaptation Note
              </span>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                {culturalNote || 'Aligned with saved client language rules and banned-term guardrails.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
