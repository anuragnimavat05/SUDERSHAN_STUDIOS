import React, { useState } from 'react';
import { Loader2, Repeat2, Save, Send } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { repurposeContentApi } from '../services/studioApi';
import type { RepurposedOutputs } from '../types/studio';

export const RepurposeEngineView: React.FC = () => {
  const { activeClient, brandContext, permissions, isDemoMode, saveContentAsset, notify } =
    useStudio();

  const [sourceTitle, setSourceTitle] = useState('Preserving Handloom Patola & Ajrakh Silks');
  const [sourceType, setSourceType] = useState('Long-Form Blog / Newsletter');
  const [targetLanguage, setTargetLanguage] = useState('English with Gujarati & Hindi resonance');
  const [sourceContent, setSourceContent] = useState(
    'Many heirloom silk buyers unknowingly damage natural-dyed Patola and Ajrakh drapes by sealing them inside plastic dry-cleaning covers. Natural madder and indigo dyes require airflow. Wrap heirloom textiles in unbleached cotton muslin, refold along alternate creases every 90 days so zari borders do not crack, and keep dried neem leaves nearby instead of synthetic mothballs.'
  );

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [kitTitle, setKitTitle] = useState('Ajrakh & Patola Care — Multi-Channel Repurpose Kit');
  const [outputs, setOutputs] = useState<RepurposedOutputs>({
    instagramCarousel: [
      'Slide 1: Why plastic garment covers quietly age handloom silks',
      'Slide 2: Trap #1 — Monsoon humidity condenses inside synthetic bags',
      'Slide 3: Refold every 90 days along alternate lines to protect zari',
      'Slide 4: Wrap in unbleached mulmul + dried neem leaves for airflow',
      'Slide 5: Save this care ritual for your winter wedding wardrobe',
    ],
    reelScriptSummary:
      '20s myth-buster opening on unzipping a plastic garment bag -> cutting to breathable unbleached cotton potli wrapping.',
    linkedinPost:
      'True textile stewardship begins after the loom. Here is how our 42 weaver families advise collectors to preserve natural-dyed Patola and Ajrakh across generations...',
    threadsSequence: [
      '1/ Stop storing heirloom silk sarees inside dry-cleaning plastic bags.',
      '2/ Natural indigo and madder fibers need airflow—switch to unbleached cotton muslin.',
      '3/ Refold along alternate creases every 3 months so gold zari never develops permanent stress lines.',
    ],
    whatsappBroadcast:
      'Namaste from Aaranya Looms. Before winter wedding season begins, here is our 3-step muslin care checklist to keep your heirloom Patola & Ajrakh luminous for decades.',
  });
  const [hashtags, setHashtags] = useState<string[]>([
    '#HeirloomCare',
    '#HandloomIndia',
    '#AaranyaLooms',
  ]);

  const handleRepurpose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceContent.trim().length < 20) {
      setErrorMsg('Please paste at least 20 characters of source content to repurpose.');
      return;
    }
    setErrorMsg('');
    setGenerating(true);
    try {
      const result = await repurposeContentApi(
        {
          brand: brandContext,
          sourceTitle: sourceTitle.trim(),
          sourceType,
          sourceContent: sourceContent.trim(),
          targetLanguage,
        },
        isDemoMode
      );
      setKitTitle(result.title || `${sourceTitle} — Repurposed Kit`);
      setOutputs({
        instagramCarousel: result.instagramCarousel || [],
        reelScriptSummary: result.reelScriptSummary || '',
        linkedinPost: result.linkedinPost || '',
        threadsSequence: result.threadsSequence || [],
        whatsappBroadcast: result.whatsappBroadcast || '',
      });
      setHashtags(result.hashtags || []);
      notify('success', 'Repurposed pillar material into 5 channel-ready formats.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Repurposing failed.';
      setErrorMsg(msg);
      notify('error', msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'in_review') => {
    await saveContentAsset({
      title: kitTitle.trim() || 'Repurposed Content Kit',
      assetType: 'repurposed_kit',
      platform: 'Multi-Channel',
      pillar: 'Repurposed Pillar',
      status,
      languages: ['en', 'hi', 'gu'],
      captions: { en: outputs.linkedinPost || outputs.whatsappBroadcast || '' },
      hashtags,
      repurposedOutputs: outputs,
    });
  };

  if (!activeClient) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Source Material Panel */}
      <section className="xl:col-span-5 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div>
          <h1 className="font-display text-lg font-bold text-[#F8FAFC]">
            AI Content Repurposing Engine
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Multiply one pillar asset for {activeClient.name} into Instagram Carousel slides, a Reel
            concept, LinkedIn post, Threads hook chain, and WhatsApp community copy.
          </p>
        </div>

        <form onSubmit={handleRepurpose} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="rep-title" className="block text-xs font-medium text-[#CBD5E1]">
              Source Asset Title
            </label>
            <input
              id="rep-title"
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              disabled={!permissions.canCreateContent}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="rep-type" className="block text-xs font-medium text-[#CBD5E1]">
                Source Format
              </label>
              <select
                id="rep-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                disabled={!permissions.canCreateContent}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
              >
                <option value="Long-Form Blog / Newsletter">Blog / Newsletter</option>
                <option value="YouTube / Podcast Transcript">YouTube / Podcast Transcript</option>
                <option value="Winning Instagram Reel">Winning Instagram Reel</option>
                <option value="Product Launch Dossier">Product Launch Dossier</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-lang" className="block text-xs font-medium text-[#CBD5E1]">
                Output Language Mix
              </label>
              <select
                id="rep-lang"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={!permissions.canCreateContent}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
              >
                <option value="English with Gujarati & Hindi resonance">English + Regional</option>
                <option value="Native Gujarati (ગુજરાતી)">Native Gujarati (ગુજરાતી)</option>
                <option value="Native Hindi (हिन्दी)">Native Hindi (हिन्दी)</option>
                <option value="English">Editorial English</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rep-body" className="block text-xs font-medium text-[#CBD5E1]">
              Source Material
            </label>
            <textarea
              id="rep-body"
              rows={8}
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              disabled={!permissions.canCreateContent}
              placeholder="Paste your article, transcript, or top-performing post..."
              className="w-full px-3 py-2 text-sm leading-relaxed rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
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
                <span>Repurposing Across Channels...</span>
              </>
            ) : (
              <>
                <Repeat2 className="w-4 h-4" />
                <span>Generate 5-Channel Kit</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Output Channels */}
      <section className="xl:col-span-7 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              aria-label="Repurposed kit title"
              value={kitTitle}
              onChange={(e) => setKitTitle(e.target.value)}
              className="w-full bg-transparent font-display text-base font-semibold text-[#F8FAFC] focus:outline-none"
            />
            <div className="text-xs text-[#94A3B8] mt-0.5">
              Carousel · Reel Angle · LinkedIn · Threads · WhatsApp Broadcast
            </div>
          </div>

          {permissions.canCreateContent && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSave('draft')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:bg-[#19212D] cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('in_review')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Kit</span>
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-white/[0.07]">
          <div className="p-6 space-y-2.5">
            <h2 className="text-xs font-semibold text-[#E5A024]">Instagram Carousel Blueprint</h2>
            <ol className="space-y-2 text-sm text-[#E6EDF3]">
              {(outputs.instagramCarousel || []).map((slide, idx) => (
                <li key={idx} className="leading-relaxed">
                  {slide}
                </li>
              ))}
            </ol>
          </div>

          <div className="p-6 space-y-2">
            <h2 className="text-xs font-semibold text-[#E5A024]">Short-Form Reel Angle</h2>
            <p className="text-sm text-[#CBD5E1] leading-relaxed">{outputs.reelScriptSummary}</p>
          </div>

          <div className="p-6 space-y-2">
            <h2 className="text-xs font-semibold text-[#E5A024]">LinkedIn Executive Post</h2>
            <p className="text-sm text-[#CBD5E1] whitespace-pre-line leading-relaxed">
              {outputs.linkedinPost}
            </p>
          </div>

          <div className="p-6 space-y-2.5">
            <h2 className="text-xs font-semibold text-[#E5A024]">Threads / X Sequence</h2>
            <div className="space-y-2 text-sm text-[#CBD5E1]">
              {(outputs.threadsSequence || []).map((post, idx) => (
                <p key={idx} className="leading-relaxed">
                  {post}
                </p>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-2 bg-[#0E131A]/60">
            <h2 className="text-xs font-semibold text-[#E5A024]">WhatsApp VIP Broadcast</h2>
            <p className="text-sm text-[#E6EDF3] leading-relaxed">{outputs.whatsappBroadcast}</p>
            <div className="pt-2 font-mono text-xs text-[#94A3B8]">{hashtags.join(' ')}</div>
          </div>
        </div>
      </section>
    </div>
  );
};
