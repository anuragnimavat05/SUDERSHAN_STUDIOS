import React, { useEffect, useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { AgencyRole, BrandMemoryItem, MemoryCategory } from '../types/studio';
import { validateExternalHttpUrl } from '../utils/urlSafety';

const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  voice_rule: 'Voice Rule',
  audience_persona: 'Audience Persona',
  content_pillar: 'Content Pillar',
  cultural_context: 'Cultural Nuance',
  do_not_use: 'Guardrail / Avoid',
  winning_pattern: 'Winning Pattern',
};

const LANGUAGE_LABELS: Record<string, string> = {
  all: 'All Languages',
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  gu: 'Gujarati (ગુજરાતી)',
};

export const BrandMemoryView: React.FC = () => {
  const {
    activeClient,
    memoryItems,
    permissions,
    updateClientWorkspace,
    addClientMember,
    removeClientMember,
    addMemoryItem,
    deleteMemoryItem,
    notify,
  } = useStudio();

  const [tab, setTab] = useState<'memory' | 'profile' | 'access'>('memory');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Brand Profile form state
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryMarkets, setPrimaryMarkets] = useState('');
  const [brandSummary, setBrandSummary] = useState('');
  const [bannedTerms, setBannedTerms] = useState('');
  const [brightBeanWorkspaceId, setBrightBeanWorkspaceId] = useState('');
  const [brightBeanWebhookUrl, setBrightBeanWebhookUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New Memory form state
  const [memCategory, setMemCategory] = useState<MemoryCategory>('voice_rule');
  const [memLang, setMemLang] = useState<BrandMemoryItem['languageScope']>('all');
  const [memTitle, setMemTitle] = useState('');
  const [memDetail, setMemDetail] = useState('');
  const [memError, setMemError] = useState('');

  // Add Member form state
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberUid, setMemberUid] = useState('');
  const [memberRole, setMemberRole] = useState<AgencyRole>('client_reviewer');

  useEffect(() => {
    if (!activeClient) return;
    setIndustry(activeClient.industry || '');
    setWebsite(activeClient.website || '');
    setPrimaryMarkets(activeClient.primaryMarkets || '');
    setBrandSummary(activeClient.brandSummary || '');
    setBannedTerms(activeClient.bannedTerms || '');
    setBrightBeanWorkspaceId(activeClient.brightBeanWorkspaceId || '');
    setBrightBeanWebhookUrl(activeClient.brightBeanWebhookUrl || '');
  }, [activeClient]);

  if (!activeClient) {
    return null;
  }

  const filteredMemory =
    categoryFilter === 'all'
      ? memoryItems
      : memoryItems.filter((m) => m.category === categoryFilter);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canEditBrand) return;

    if (brightBeanWebhookUrl.trim()) {
      const urlCheck = validateExternalHttpUrl(brightBeanWebhookUrl.trim());
      if (!urlCheck.valid) {
        notify('error', urlCheck.error || 'Invalid BrightBean webhook URL.');
        return;
      }
    }

    setSavingProfile(true);
    try {
      await updateClientWorkspace(activeClient.id, {
        industry,
        website,
        primaryMarkets,
        brandSummary,
        bannedTerms,
        brightBeanWorkspaceId,
        brightBeanWebhookUrl: brightBeanWebhookUrl.trim(),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memTitle.trim() || !memDetail.trim()) {
      setMemError('Both a memory title and detailed guidance are required.');
      return;
    }
    setMemError('');
    await addMemoryItem({
      category: memCategory,
      title: memTitle,
      detail: memDetail,
      languageScope: memLang,
    });
    setMemTitle('');
    setMemDetail('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) {
      notify('error', 'Member name and email are required.');
      return;
    }
    await addClientMember({
      name: memberName,
      email: memberEmail,
      uid: memberUid || memberEmail.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      role: memberRole,
    });
    setMemberName('');
    setMemberEmail('');
    setMemberUid('');
  };

  return (
    <div className="space-y-7">
      {/* Client Identity Summary Header */}
      <section className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#94A3B8]">
            <span>{activeClient.industry}</span>
            <span aria-hidden="true">·</span>
            <span>{activeClient.primaryMarkets || 'Global'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">
              BrightBean: {activeClient.brightBeanWorkspaceId || 'Unlinked'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC]">{activeClient.name}</h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            {activeClient.brandSummary || 'Add a brand summary so every Gemini prompt stays on-voice.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 shrink-0 border-t md:border-t-0 md:border-l border-white/[0.08] pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-xs text-[#94A3B8]">Memory Rules</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC] mt-0.5">
              {memoryItems.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#94A3B8]">Languages</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-[#E5A024] mt-0.5">
              {activeClient.defaultLanguages.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#94A3B8]">Members</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC] mt-0.5">
              {activeClient.memberDirectory.length || activeClient.memberUids.length}
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-3">
        <div
          role="tablist"
          aria-label="Brand workspace sections"
          className="flex items-center gap-1 p-1 bg-[#131922] border border-white/[0.08] rounded-lg max-w-full overflow-x-auto"
        >
          {[
            { id: 'memory', label: 'Voice & Memory' },
            { id: 'profile', label: 'Profile & BrightBean' },
            { id: 'access', label: 'Access & Roles' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === item.id
                  ? 'bg-[#E5A024] text-[#090C10] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Brand Voice & Audience Memory */}
      {tab === 'memory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Add Memory Form */}
          <div className="lg:col-span-5 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Add Brand Memory Rule
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Every saved rule is automatically injected into Gemini prompts for {activeClient.name}.
              </p>
            </div>

            <form onSubmit={handleAddMemory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="mem-category" className="block text-xs font-medium text-[#CBD5E1]">
                    Memory Type
                  </label>
                  <select
                    id="mem-category"
                    value={memCategory}
                    onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                    disabled={!permissions.canEditBrand}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                  >
                    {Object.entries(MEMORY_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mem-lang" className="block text-xs font-medium text-[#CBD5E1]">
                    Language Scope
                  </label>
                  <select
                    id="mem-lang"
                    value={memLang}
                    onChange={(e) => setMemLang(e.target.value as BrandMemoryItem['languageScope'])}
                    disabled={!permissions.canEditBrand}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                  >
                    {Object.entries(LANGUAGE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mem-title" className="block text-xs font-medium text-[#CBD5E1]">
                  Rule Title
                </label>
                <input
                  id="mem-title"
                  type="text"
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                  disabled={!permissions.canEditBrand}
                  placeholder="e.g., Festive Gujarati Warmth Without Discount Clichés"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mem-detail" className="block text-xs font-medium text-[#CBD5E1]">
                  Guidance & Examples
                </label>
                <textarea
                  id="mem-detail"
                  rows={4}
                  value={memDetail}
                  onChange={(e) => setMemDetail(e.target.value)}
                  disabled={!permissions.canEditBrand}
                  placeholder="Describe audience pain points, cultural tone, preferred idioms, or patterns to preserve..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                />
              </div>

              {memError && <p className="text-xs text-[#F87171]">{memError}</p>}

              <button
                type="submit"
                disabled={!permissions.canEditBrand}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {permissions.canEditBrand ? 'Save to Brand Memory' : 'Read-Only for Reviewer Role'}
                </span>
              </button>
            </form>
          </div>

          {/* Memory Ledger */}
          <div className="lg:col-span-7 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Active Memory Bank
              </h2>
              <div className="flex items-center gap-2">
                <label htmlFor="memory-filter" className="sr-only">
                  Filter memory category
                </label>
                <select
                  id="memory-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-md bg-[#090C10] border border-white/[0.1] text-[#CBD5E1] focus:outline-none focus:border-[#E5A024]"
                >
                  <option value="all">All Categories ({memoryItems.length})</option>
                  {Object.entries(MEMORY_CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredMemory.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-[#CBD5E1]">No memory rules in this category yet.</p>
                <p className="text-xs text-[#64748B]">
                  Add voice rules, audience personas, or cultural cues on the left to ground AI output.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filteredMemory.map((item) => (
                  <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-white/[0.02]">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                        <span className="text-[#E5A024] font-medium">
                          {MEMORY_CATEGORY_LABELS[item.category]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{LANGUAGE_LABELS[item.languageScope]}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#F8FAFC]">{item.title}</h3>
                      <p className="text-sm text-[#94A3B8] leading-relaxed">{item.detail}</p>
                    </div>

                    {permissions.canEditBrand && (
                      <button
                        type="button"
                        onClick={() => deleteMemoryItem(item.id)}
                        aria-label={`Delete memory rule ${item.title}`}
                        className="p-2 rounded-lg text-[#64748B] hover:text-[#F87171] hover:bg-white/[0.04] transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Brand Profile & BrightBean Studio Configuration */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-6 max-w-4xl"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
              Brand Profile & BrightBean Studio Bridge
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Sudershan AI handles content strategy and approvals; BrightBean Studio remains your
              system of record for OAuth, scheduling, and Instagram publishing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="bp-industry" className="block text-xs font-medium text-[#CBD5E1]">
                Industry
              </label>
              <input
                id="bp-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={!permissions.canEditBrand}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bp-markets" className="block text-xs font-medium text-[#CBD5E1]">
                Primary Geographies & Markets
              </label>
              <input
                id="bp-markets"
                type="text"
                value={primaryMarkets}
                onChange={(e) => setPrimaryMarkets(e.target.value)}
                disabled={!permissions.canEditBrand}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bp-website" className="block text-xs font-medium text-[#CBD5E1]">
                Brand Website
              </label>
              <input
                id="bp-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={!permissions.canEditBrand}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bp-banned" className="block text-xs font-medium text-[#CBD5E1]">
                Banned Terms & Phrases
              </label>
              <input
                id="bp-banned"
                type="text"
                value={bannedTerms}
                onChange={(e) => setBannedTerms(e.target.value)}
                disabled={!permissions.canEditBrand}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bp-summary" className="block text-xs font-medium text-[#CBD5E1]">
              Brand Narrative & Positioning Summary
            </label>
            <textarea
              id="bp-summary"
              rows={3}
              value={brandSummary}
              onChange={(e) => setBrandSummary(e.target.value)}
              disabled={!permissions.canEditBrand}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
            />
          </div>

          <div className="pt-4 border-t border-white/[0.08] space-y-4">
            <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
              BrightBean Studio Handoff Endpoint
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="bb-ws-id" className="block text-xs font-medium text-[#CBD5E1]">
                  BrightBean Workspace ID
                </label>
                <input
                  id="bb-ws-id"
                  type="text"
                  value={brightBeanWorkspaceId}
                  onChange={(e) => setBrightBeanWorkspaceId(e.target.value)}
                  disabled={!permissions.canManageClient}
                  placeholder="bb-ws-client-01"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="bb-webhook" className="block text-xs font-medium text-[#CBD5E1]">
                  BrightBean Inbound Webhook URL (Optional HTTPS)
                </label>
                <input
                  id="bb-webhook"
                  type="url"
                  value={brightBeanWebhookUrl}
                  onChange={(e) => setBrightBeanWebhookUrl(e.target.value)}
                  disabled={!permissions.canManageClient}
                  placeholder="https://brightbean.yourdomain.com/api/webhooks/sudershan"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] placeholder:text-[#475569] focus:outline-none focus:border-[#E5A024] disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {permissions.canEditBrand && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Brand Profile'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 3: Client Access & Roles */}
      {tab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-[#131922] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08]">
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Scoped Workspace Roster
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Only listed accounts can read or mutate data inside {activeClient.name}.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.07] text-xs text-[#94A3B8]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {activeClient.memberDirectory.map((m) => (
                    <tr key={m.uid} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-[#F8FAFC]">{m.name}</div>
                        <div className="text-xs text-[#94A3B8] font-mono">{m.email}</div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-[#CBD5E1]">
                        {m.role === 'admin'
                          ? 'Agency Admin'
                          : m.role === 'strategist'
                          ? 'Strategist'
                          : 'Client Reviewer'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {permissions.canManageMembers && m.uid !== activeClient.ownerUid ? (
                          <button
                            type="button"
                            onClick={() => removeClientMember(m.uid)}
                            className="text-xs text-[#F87171] hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-xs text-[#64748B]">
                            {m.uid === activeClient.ownerUid ? 'Owner' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Assign Team or Client Reviewer
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Grant scoped access strictly to {activeClient.name} without exposing other agency clients.
              </p>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="m-name" className="block text-xs font-medium text-[#CBD5E1]">
                  Full Name
                </label>
                <input
                  id="m-name"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  disabled={!permissions.canManageMembers}
                  placeholder="Priya Patel"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-email" className="block text-xs font-medium text-[#CBD5E1]">
                  Google Account Email
                </label>
                <input
                  id="m-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  disabled={!permissions.canManageMembers}
                  placeholder="priya@clientbrand.in"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-uid" className="block text-xs font-medium text-[#CBD5E1]">
                  Firebase User UID (Optional for invite tracking)
                </label>
                <input
                  id="m-uid"
                  type="text"
                  value={memberUid}
                  onChange={(e) => setMemberUid(e.target.value)}
                  disabled={!permissions.canManageMembers}
                  placeholder="Auto-generated if left blank"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-role" className="block text-xs font-medium text-[#CBD5E1]">
                  Workspace Role
                </label>
                <select
                  id="m-role"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as AgencyRole)}
                  disabled={!permissions.canManageMembers}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] disabled:opacity-50"
                >
                  <option value="client_reviewer">Client Reviewer (Read, Comment & Approve)</option>
                  <option value="strategist">Strategist (Create, Revise & Handoff)</option>
                  <option value="admin">Agency Admin (Full Workspace Control)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!permissions.canManageMembers}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {permissions.canManageMembers ? 'Grant Scoped Access' : 'Agency Admin Only'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
