import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileJson,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Webhook,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { dispatchBrightBeanWebhookApi, generateAiRevisionApi } from '../services/studioApi';
import type { AssetStatus, ContentAsset } from '../types/studio';
import {
  buildBrightBeanCsv,
  buildBrightBeanPayload,
  canTransitionAssetStatus,
} from '../utils/workflow';

const STATUS_META: Record<AssetStatus, { label: string; colorClass: string }> = {
  draft: { label: 'Draft', colorClass: 'text-[#94A3B8]' },
  in_review: { label: 'In Review', colorClass: 'text-[#F59E0B]' },
  revision_requested: { label: 'Revision Requested', colorClass: 'text-[#F87171]' },
  approved: { label: 'Approved', colorClass: 'text-[#22C55E]' },
  handed_off: { label: 'Handed Off to BrightBean', colorClass: 'text-[#E5A024]' },
};

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ApprovalPipelineView: React.FC = () => {
  const {
    activeClient,
    brandContext,
    assets,
    revisions,
    effectiveRole,
    permissions,
    isDemoMode,
    transitionAssetStatus,
    updateAssetContent,
    notify,
  } = useStudio();

  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [captionTab, setCaptionTab] = useState<'en' | 'hi' | 'gu'>('en');
  const [revisingWithAi, setRevisingWithAi] = useState(false);
  const [dispatchingWebhook, setDispatchingWebhook] = useState(false);

  const filteredAssets = useMemo(() => {
    if (statusFilter === 'all') return assets;
    return assets.filter((a) => a.status === statusFilter);
  }, [assets, statusFilter]);

  const selectedAsset: ContentAsset | null = useMemo(() => {
    if (filteredAssets.length === 0) return null;
    return filteredAssets.find((a) => a.id === selectedAssetId) || filteredAssets[0];
  }, [filteredAssets, selectedAssetId]);

  const assetRevisions = useMemo(() => {
    if (!selectedAsset) return [];
    return revisions.filter((r) => r.assetId === selectedAsset.id);
  }, [revisions, selectedAsset]);

  if (!activeClient) return null;

  const handleTransition = async (nextStatus: AssetStatus) => {
    if (!selectedAsset) return;
    if (nextStatus === 'revision_requested' && !noteInput.trim()) {
      notify('error', 'Please enter a specific revision note before requesting changes.');
      return;
    }
    await transitionAssetStatus(
      selectedAsset.id,
      nextStatus,
      noteInput.trim() || `Moved to ${STATUS_META[nextStatus].label}.`
    );
    setNoteInput('');
  };

  const handleAiRevise = async () => {
    if (!selectedAsset) return;
    const feedback = noteInput.trim() || selectedAsset.reviewerNote || '';
    if (!feedback) {
      notify('error', 'Enter reviewer feedback in the note box to run AI-assisted revision.');
      return;
    }
    setRevisingWithAi(true);
    try {
      const cleanCaptions: Record<string, string> = {};
      if (selectedAsset.captions) {
        for (const [k, v] of Object.entries(selectedAsset.captions)) {
          if (v) cleanCaptions[k] = v;
        }
      }
      const result = await generateAiRevisionApi(
        {
          brand: brandContext,
          title: selectedAsset.title,
          captions: cleanCaptions,
          feedbackNote: feedback,
        },
        isDemoMode
      );
      await updateAssetContent(
        selectedAsset.id,
        { captions: { ...selectedAsset.captions, ...result.captions } },
        `AI revision applied: ${result.revisionSummary}`
      );
      setNoteInput('');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'AI revision failed.');
    } finally {
      setRevisingWithAi(false);
    }
  };

  const handleExportSingleJson = () => {
    if (!selectedAsset) return;
    const payload = buildBrightBeanPayload(activeClient, selectedAsset);
    downloadFile(
      `${activeClient.id}-${selectedAsset.id}-brightbean.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    notify('success', 'Downloaded BrightBean Studio JSON handoff packet.');
  };

  const handleExportApprovedCsv = () => {
    const readyAssets = assets.filter(
      (a) => a.status === 'approved' || a.status === 'handed_off'
    );
    const target = readyAssets.length ? readyAssets : assets;
    if (target.length === 0) {
      notify('info', 'No content assets available to export.');
      return;
    }
    const csv = buildBrightBeanCsv(activeClient, target);
    downloadFile(
      `${activeClient.id}-brightbean-handoff.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    notify('success', `Exported ${target.length} asset(s) as BrightBean-ready CSV.`);
  };

  const handleWebhookDispatch = async () => {
    if (!selectedAsset) return;
    const payload = buildBrightBeanPayload(activeClient, selectedAsset);

    if (!activeClient.brightBeanWebhookUrl) {
      // Allow clean export-based handoff marking even when no external webhook URL is configured
      const refId = `BB-EXPORT-${Date.now().toString(36).toUpperCase()}`;
      downloadFile(
        `${activeClient.id}-${selectedAsset.id}-brightbean.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8'
      );
      await transitionAssetStatus(
        selectedAsset.id,
        'handed_off',
        `Exported BrightBean JSON packet (${refId}). Add an HTTPS webhook URL in Brand Profile for direct dispatch.`,
        { brightBeanStatus: 'exported', brightBeanReference: refId }
      );
      return;
    }

    setDispatchingWebhook(true);
    try {
      const result = await dispatchBrightBeanWebhookApi(
        {
          webhookUrl: activeClient.brightBeanWebhookUrl,
          payload: payload as unknown as Record<string, unknown>,
        },
        isDemoMode
      );
      await transitionAssetStatus(
        selectedAsset.id,
        'handed_off',
        `Dispatched signed webhook to BrightBean Studio (${result.reference}, HTTP ${result.statusCode}).`,
        { brightBeanStatus: 'webhook_sent', brightBeanReference: result.reference }
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'BrightBean webhook dispatch failed.');
    } finally {
      setDispatchingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Bulk Export */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#131922] border border-white/[0.08] rounded-lg overflow-x-auto">
          {(
            [
              ['all', 'All Assets'],
              ['draft', 'Draft'],
              ['in_review', 'In Review'],
              ['revision_requested', 'Revisions'],
              ['approved', 'Approved'],
              ['handed_off', 'Handed Off'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === value
                  ? 'bg-[#E5A024] text-[#090C10] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportApprovedCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#E5A024]" />
          <span>Export BrightBean CSV</span>
        </button>
      </section>

      {filteredAssets.length === 0 ? (
        <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-12 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#64748B] mx-auto" />
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            No assets in this workflow stage
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Create captions, Reel scripts, or repurposed kits in the studio to move them through approval.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Queue List */}
          <div className="xl:col-span-5 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Approval Queue</span>
              <span className="font-mono tabular-nums">{filteredAssets.length} items</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {filteredAssets.map((asset) => {
                const active = selectedAsset?.id === asset.id;
                const statusInfo = STATUS_META[asset.status];
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`w-full px-5 py-4 text-left transition-colors cursor-pointer ${
                      active ? 'bg-[#19212D]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-medium ${statusInfo.colorClass}`}>
                        {statusInfo.label}
                      </span>
                      <span className="font-mono tabular-nums text-[#64748B]">v{asset.version}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#F8FAFC] mt-1 line-clamp-1">
                      {asset.title}
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-1">
                      {asset.platform} · {asset.pillar} · {asset.languages.join('/').toUpperCase()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Review Inspector & BrightBean Handoff */}
          {selectedAsset && (
            <div className="xl:col-span-7 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-semibold ${STATUS_META[selectedAsset.status].colorClass}`}>
                      {STATUS_META[selectedAsset.status].label}
                    </span>
                    <span aria-hidden="true" className="text-[#475569]">·</span>
                    <span className="font-mono tabular-nums text-[#94A3B8]">
                      Version {selectedAsset.version}
                    </span>
                    <span aria-hidden="true" className="text-[#475569]">·</span>
                    <span className="text-[#94A3B8]">{selectedAsset.platform}</span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-[#F8FAFC] mt-1">
                    {selectedAsset.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleExportSingleJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#090C10] border border-white/[0.1] text-[#CBD5E1] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap"
                >
                  <FileJson className="w-3.5 h-3.5 text-[#E5A024]" />
                  <span>JSON Packet</span>
                </button>
              </div>

              {/* Asset Body Preview */}
              <div className="p-6 space-y-5 border-b border-white/[0.08]">
                {selectedAsset.captions && Object.keys(selectedAsset.captions).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 p-1 bg-[#090C10] border border-white/[0.08] rounded-lg w-fit">
                      {(['en', 'hi', 'gu'] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setCaptionTab(lang)}
                          className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                            captionTab === lang
                              ? 'bg-[#19212D] text-[#F8FAFC]'
                              : 'text-[#94A3B8] hover:text-[#E6EDF3]'
                          }`}
                        >
                          {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 rounded-lg bg-[#090C10] border border-white/[0.07] text-sm text-[#E6EDF3] whitespace-pre-line leading-relaxed">
                      {selectedAsset.captions[captionTab] ||
                        selectedAsset.captions.en ||
                        'No caption copy in this language.'}
                    </div>
                  </div>
                )}

                {selectedAsset.reelScenes && selectedAsset.reelScenes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#94A3B8]">Reel Script Scenes</div>
                    <div className="divide-y divide-white/[0.06] border border-white/[0.07] rounded-lg bg-[#090C10]">
                      {selectedAsset.reelScenes.map((scene, i) => (
                        <div key={i} className="p-3 text-xs grid grid-cols-12 gap-3">
                          <span className="col-span-3 font-mono text-[#E5A024] tabular-nums">
                            {scene.timecode}
                          </span>
                          <span className="col-span-9 text-[#CBD5E1]">{scene.voiceover}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAsset.repurposedOutputs?.instagramCarousel && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#94A3B8]">Repurposed Carousel</div>
                    <ul className="space-y-1.5 text-xs text-[#CBD5E1] bg-[#090C10] p-4 rounded-lg border border-white/[0.07]">
                      {selectedAsset.repurposedOutputs.instagramCarousel.map((slide, i) => (
                        <li key={i}>{slide}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedAsset.hashtags && selectedAsset.hashtags.length > 0 && (
                  <div className="font-mono text-xs text-[#E5A024]">
                    {selectedAsset.hashtags.join(' ')}
                  </div>
                )}
              </div>

              {/* Action Controls & Role-Gated Transitions */}
              <div className="p-6 space-y-4 border-b border-white/[0.08] bg-[#0E131A]/60">
                <div className="space-y-1.5">
                  <label htmlFor="rev-note" className="block text-xs font-medium text-[#CBD5E1]">
                    Approval Comment or Revision Instructions
                  </label>
                  <textarea
                    id="rev-note"
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add feedback for the strategist, approval sign-off note, or BrightBean handoff memo..."
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {canTransitionAssetStatus(effectiveRole, selectedAsset.status, 'in_review') && (
                    <button
                      type="button"
                      onClick={() => handleTransition('in_review')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit for Client Review</span>
                    </button>
                  )}

                  {canTransitionAssetStatus(effectiveRole, selectedAsset.status, 'approved') && (
                    <button
                      type="button"
                      onClick={() => handleTransition('approved')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#22C55E] text-[#090C10] hover:bg-[#16A34A] cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Asset</span>
                    </button>
                  )}

                  {canTransitionAssetStatus(
                    effectiveRole,
                    selectedAsset.status,
                    'revision_requested'
                  ) && (
                    <button
                      type="button"
                      onClick={() => handleTransition('revision_requested')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#090C10] border border-[#EF4444]/40 text-[#F87171] hover:bg-[#EF4444]/10 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Request Revision</span>
                    </button>
                  )}

                  {permissions.canCreateContent &&
                    selectedAsset.status !== 'handed_off' && (
                      <button
                        type="button"
                        onClick={handleAiRevise}
                        disabled={revisingWithAi}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#131922] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {revisingWithAi ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#E5A024]" />
                        )}
                        <span>Apply AI Revision</span>
                      </button>
                    )}

                  {permissions.canDispatchHandoff && selectedAsset.status === 'approved' && (
                    <button
                      type="button"
                      onClick={handleWebhookDispatch}
                      disabled={dispatchingWebhook}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {dispatchingWebhook ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Webhook className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {activeClient.brightBeanWebhookUrl
                          ? 'Dispatch to BrightBean Webhook'
                          : 'Export & Mark Handed Off'}
                      </span>
                    </button>
                  )}
                </div>

                {selectedAsset.brightBeanReference && (
                  <p className="text-xs font-mono text-[#E5A024]">
                    BrightBean Handoff Ref: {selectedAsset.brightBeanReference}
                  </p>
                )}
              </div>

              {/* Immutable Revision History */}
              <div className="p-6 space-y-3">
                <h3 className="text-xs font-semibold text-[#94A3B8]">
                  Revision &amp; Approval Audit Trail
                </h3>
                {assetRevisions.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No revision events logged yet.</p>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {assetRevisions.map((rev) => (
                      <div key={rev.id} className="py-3 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="text-xs text-[#CBD5E1]">
                            <span className="font-semibold text-[#F8FAFC]">{rev.actorName}</span>
                            <span aria-hidden="true" className="text-[#475569]"> · </span>
                            <span className="text-[#94A3B8]">{rev.action.replace('_', ' ')}</span>
                            <span aria-hidden="true" className="text-[#475569]"> · </span>
                            <span className="font-mono text-[#64748B]">v{rev.version}</span>
                          </div>
                          <p className="text-xs text-[#94A3B8] leading-relaxed">{rev.note}</p>
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-[#64748B] shrink-0">
                          {rev.createdAt.slice(0, 10)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
