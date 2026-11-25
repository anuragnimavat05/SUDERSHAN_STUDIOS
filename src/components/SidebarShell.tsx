import React, { useState } from 'react';
import {
  BarChart3,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Languages,
  LogOut,
  Menu,
  Plus,
  Repeat2,
  SearchCode,
  X,
  Zap,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { AgencyRole, StudioView } from '../types/studio';

interface NavGroup {
  heading: string;
  items: Array<{
    id: StudioView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Strategy & Memory',
    items: [
      { id: 'brand', label: 'Brand & Memory', icon: BookMarked },
      { id: 'calendar', label: 'Content Calendar', icon: CalendarDays },
      { id: 'competitors', label: 'Competitor Intel', icon: SearchCode },
    ],
  },
  {
    heading: 'AI Creation Studio',
    items: [
      { id: 'daily', label: 'Daily Autopilot', icon: Zap },
      { id: 'captions', label: 'Multilingual Captions', icon: Languages },
      { id: 'reels', label: 'Reel Hooks & Scripts', icon: Clapperboard },
      { id: 'repurpose', label: 'Content Repurposing', icon: Repeat2 },
    ],
  },
  {
    heading: 'Governance & Growth',
    items: [
      { id: 'approvals', label: 'Approvals & BrightBean', icon: CheckCircle2 },
      { id: 'performance', label: 'Performance Insights', icon: BarChart3 },
    ],
  },
];

const VIEW_TITLES: Record<StudioView, string> = {
  brand: 'Brand Profile & Audience Memory',
  daily: 'Daily Research & 1-Post Autopilot',
  calendar: 'Monthly Content Calendar Studio',
  captions: 'Multilingual Caption Studio',
  reels: 'Instagram Reel Hooks & Script Lab',
  competitors: 'Competitor Content Intelligence',
  repurpose: 'AI Content Repurposing Engine',
  approvals: 'Approval Workflow & BrightBean Handoff',
  performance: 'Performance Analysis & Recommendations',
};

const ROLE_LABELS: Record<AgencyRole, string> = {
  admin: 'Agency Admin',
  strategist: 'Strategist',
  client_reviewer: 'Client Reviewer',
};

interface SidebarShellProps {
  children: React.ReactNode;
  onOpenNewClientModal: () => void;
}

export const SidebarShell: React.FC<SidebarShellProps> = ({
  children,
  onOpenNewClientModal,
}) => {
  const {
    sessionUser,
    isDemoMode,
    activeView,
    setActiveView,
    clients,
    activeClient,
    setActiveClientId,
    effectiveRole,
    permissions,
    demoRoleOverride,
    setDemoRoleOverride,
    assets,
    loginWithGoogle,
    logout,
    toast,
    dismissToast,
  } = useStudio();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);

  const pendingReviewCount = assets.filter((a) => a.status === 'in_review').length;
  const approvedReadyCount = assets.filter((a) => a.status === 'approved').length;

  const handleSelectView = (view: StudioView) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0E131A] border-r border-white/[0.08]">
      {/* Brand Wordmark */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.07] shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap">
          Sudershan AI
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Multi-Client Switcher */}
      <div className="p-4 border-b border-white/[0.07] relative">
        <label className="block text-[11px] font-medium text-[#64748B] mb-2">
          Active Client Workspace
        </label>
        <button
          type="button"
          onClick={() => setClientMenuOpen((v) => !v)}
          aria-expanded={clientMenuOpen}
          aria-label="Switch active client workspace"
          className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg bg-[#131922] border border-white/[0.09] hover:border-white/[0.18] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-md bg-[#E5A024]/15 text-[#E5A024] font-mono text-xs font-semibold flex items-center justify-center shrink-0">
              {activeClient?.monogram || '—'}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#F8FAFC] truncate">
                {activeClient?.name || 'No Client Selected'}
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                {activeClient?.industry || 'Create a workspace'}
              </div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
        </button>

        {clientMenuOpen && (
          <div className="absolute left-4 right-4 top-[92px] z-40 bg-[#131922] border border-white/[0.12] rounded-lg shadow-xl py-1.5">
            {clients.map((client) => {
              const selected = client.id === activeClient?.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setActiveClientId(client.id);
                    setClientMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2.5 text-left text-sm transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#E5A024]/12 text-[#F8FAFC]'
                      : 'text-[#CBD5E1] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="w-6 h-6 rounded bg-[#19212D] font-mono text-[11px] text-[#E5A024] flex items-center justify-center shrink-0">
                    {client.monogram}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{client.name}</div>
                    <div className="text-[11px] text-[#64748B] truncate">{client.primaryMarkets}</div>
                  </div>
                </button>
              );
            })}
            {permissions.canManageClient && (
              <div className="border-t border-white/[0.07] mt-1 pt-1 px-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setClientMenuOpen(false);
                    onOpenNewClientModal();
                  }}
                  className="w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-xs font-medium text-[#E5A024] hover:bg-[#E5A024]/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Client Workspace</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Studio modules" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-1">
            <div className="px-2.5 pb-1 text-[11px] font-medium text-[#64748B]">
              {group.heading}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#E5A024]/14 text-[#F8FAFC] font-medium'
                      : 'text-[#94A3B8] hover:text-[#E6EDF3] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#E5A024]' : 'text-[#64748B]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'approvals' && pendingReviewCount > 0 && (
                    <span className="font-mono text-[11px] tabular-nums text-[#E5A024]">
                      {pendingReviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Demo Role Perspective Switcher (only in Interactive Demo Mode) */}
      {isDemoMode && (
        <div className="px-4 py-3 border-t border-white/[0.07] space-y-2 bg-[#111720]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span>Demo Role Perspective</span>
            <button
              type="button"
              onClick={loginWithGoogle}
              className="text-[#E5A024] hover:underline font-medium cursor-pointer"
            >
              Sync Live
            </button>
          </div>
          <label htmlFor="demo-role-select" className="sr-only">
            Preview Role Permissions
          </label>
          <select
            id="demo-role-select"
            value={demoRoleOverride || 'admin'}
            onChange={(e) => setDemoRoleOverride(e.target.value as AgencyRole)}
            className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[#090C10] border border-white/[0.1] text-[#E6EDF3] focus:outline-none focus:border-[#E5A024]"
          >
            <option value="admin">Agency Admin (Full Control)</option>
            <option value="strategist">Strategist (Create & Revise)</option>
            <option value="client_reviewer">Client Reviewer (Approve Only)</option>
          </select>
        </div>
      )}

      {/* User Account Footer */}
      <div className="p-4 border-t border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#F8FAFC] truncate">
            {sessionUser?.displayName || 'Agency Member'}
          </div>
          <div className="text-[11px] text-[#64748B] truncate">
            {ROLE_LABELS[effectiveRole]}
            {isDemoMode ? ' · Demo' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090C10] text-[#E6EDF3] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[272px] max-w-[85vw] h-full">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={() => setMobileOpen(false)}
            className="flex-1 bg-black/70"
          />
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar Contract: Breadcrumb | Quiet Role Metadata | 1 Contextual Action */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/[0.07] bg-[#090C10]/95 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#94A3B8] truncate hidden sm:inline">
                {activeClient?.name || 'Workspaces'}
              </span>
              <span aria-hidden="true" className="text-[#475569] hidden sm:inline">
                /
              </span>
              <span className="font-display font-semibold text-[#F8FAFC] truncate">
                {VIEW_TITLES[activeView]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-[#94A3B8] whitespace-nowrap">
              <span>{ROLE_LABELS[effectiveRole]}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {approvedReadyCount} ready for BrightBean
              </span>
            </div>

            {permissions.canManageClient ? (
              <button
                type="button"
                onClick={onOpenNewClientModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Client</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('approvals')}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Review Queue
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-7 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Non-intrusive Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-[#131922] border border-white/[0.14] rounded-lg px-4 py-3 shadow-2xl flex items-center justify-between gap-4"
        >
          <span
            className={`text-xs font-medium ${
              toast.tone === 'error'
                ? 'text-[#F87171]'
                : toast.tone === 'success'
                ? 'text-[#4ADE80]'
                : 'text-[#E6EDF3]'
            }`}
          >
            {toast.text}
          </span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
