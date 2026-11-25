import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { validateExternalHttpUrl } from '../utils/urlSafety';

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({ open, onClose }) => {
  const { createClientWorkspace } = useStudio();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryMarkets, setPrimaryMarkets] = useState('Ahmedabad, Mumbai');
  const [brandSummary, setBrandSummary] = useState('');
  const [bannedTerms, setBannedTerms] = useState('');
  const [brightBeanWorkspaceId, setBrightBeanWorkspaceId] = useState('');
  const [brightBeanWebhookUrl, setBrightBeanWebhookUrl] = useState('');
  const [languages, setLanguages] = useState<string[]>(['en', 'hi', 'gu']);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const toggleLang = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((l) => l !== code)
          : prev
        : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !industry.trim()) {
      setErrorMsg('Client brand name and industry are required.');
      return;
    }
    if (brightBeanWebhookUrl.trim()) {
      const check = validateExternalHttpUrl(brightBeanWebhookUrl.trim());
      if (!check.valid) {
        setErrorMsg(check.error || 'Invalid BrightBean webhook URL.');
        return;
      }
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      await createClientWorkspace({
        name,
        industry,
        website,
        primaryMarkets,
        brandSummary,
        bannedTerms,
        defaultLanguages: languages,
        brightBeanWorkspaceId,
        brightBeanWebhookUrl,
      });
      setName('');
      setIndustry('');
      setWebsite('');
      setBrandSummary('');
      setBannedTerms('');
      setBrightBeanWorkspaceId('');
      setBrightBeanWebhookUrl('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-client-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
    >
      <div className="w-full max-w-xl bg-[#131922] border border-white/[0.12] rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 id="new-client-heading" className="font-display text-base font-semibold text-[#F8FAFC]">
            Create Isolated Client Workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create client modal"
            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="nc-name" className="block text-xs font-medium text-[#CBD5E1]">
                Client Brand Name
              </label>
              <input
                id="nc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Kutch Craft Collective"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-industry" className="block text-xs font-medium text-[#CBD5E1]">
                Industry
              </label>
              <input
                id="nc-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Fine Jewelry / D2C Food"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="nc-markets" className="block text-xs font-medium text-[#CBD5E1]">
                Target Markets
              </label>
              <input
                id="nc-markets"
                type="text"
                value={primaryMarkets}
                onChange={(e) => setPrimaryMarkets(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-bbid" className="block text-xs font-medium text-[#CBD5E1]">
                BrightBean Workspace ID
              </label>
              <input
                id="nc-bbid"
                type="text"
                value={brightBeanWorkspaceId}
                onChange={(e) => setBrightBeanWorkspaceId(e.target.value)}
                placeholder="bb-ws-client-03"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nc-summary" className="block text-xs font-medium text-[#CBD5E1]">
              Brand Summary
            </label>
            <textarea
              id="nc-summary"
              rows={2}
              value={brandSummary}
              onChange={(e) => setBrandSummary(e.target.value)}
              placeholder="Core positioning, products, and differentiators..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="nc-banned" className="block text-xs font-medium text-[#CBD5E1]">
                Banned Terms (Optional)
              </label>
              <input
                id="nc-banned"
                type="text"
                value={bannedTerms}
                onChange={(e) => setBannedTerms(e.target.value)}
                placeholder="cheap, guaranteed, blast"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-webhook" className="block text-xs font-medium text-[#CBD5E1]">
                BrightBean Webhook URL (Optional)
              </label>
              <input
                id="nc-webhook"
                type="url"
                value={brightBeanWebhookUrl}
                onChange={(e) => setBrightBeanWebhookUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#CBD5E1]">Default Studio Languages</span>
            <div className="flex items-center gap-1.5 p-1 bg-[#090C10] border border-white/[0.1] rounded-lg">
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'Hindi' },
                { code: 'gu', label: 'Gujarati' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLang(lang.code)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    languages.includes(lang.code)
                      ? 'bg-[#E5A024] text-[#090C10] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && <p className="text-xs text-[#F87171]">{errorMsg}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Client Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
