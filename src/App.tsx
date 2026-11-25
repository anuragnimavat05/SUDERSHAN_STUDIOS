import React, { useState } from 'react';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudioProvider, useStudio } from './context/StudioContext';
import { AuthGate } from './components/AuthGate';
import { SidebarShell } from './components/SidebarShell';
import { BrandMemoryView } from './components/BrandMemoryView';
import { CalendarStudioView } from './components/CalendarStudioView';
import { CaptionStudioView } from './components/CaptionStudioView';
import { ReelScriptView } from './components/ReelScriptView';
import { CompetitorIntelView } from './components/CompetitorIntelView';
import { RepurposeEngineView } from './components/RepurposeEngineView';
import { ApprovalPipelineView } from './components/ApprovalPipelineView';
import { PerformanceView } from './components/PerformanceView';
import { DailyAutopilotView } from './components/DailyAutopilotView';
import { NewClientModal } from './components/NewClientModal';

const StudioWorkspace: React.FC = () => {
  const {
    authReady,
    sessionUser,
    activeView,
    activeClient,
    permissions,
    seedStarterWorkspaces,
  } = useStudio();

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090C10] text-[#94A3B8] flex items-center justify-center gap-3 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-[#E5A024]" />
        <span>Initializing Sudershan AI Studio...</span>
      </div>
    );
  }

  if (!sessionUser) {
    return <AuthGate />;
  }

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterWorkspaces();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <SidebarShell onOpenNewClientModal={() => setNewClientOpen(true)}>
        {!activeClient ? (
          <div className="max-w-xl mx-auto mt-16 bg-[#131922] border border-white/[0.08] rounded-xl p-8 text-center space-y-5">
            <h1 className="font-display text-2xl font-bold text-[#F8FAFC]">
              Set Up Your First Client Workspace
            </h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Every client in Sudershan AI gets an isolated Firestore workspace for brand voice
              memory, multilingual captions, Reel scripts, approvals, and BrightBean Studio handoff.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {(permissions.canManageClient || permissions.canCreateContent) && (
                <button
                  type="button"
                  onClick={() => setNewClientOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Client Workspace</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#090C10] border border-white/[0.12] text-[#E6EDF3] hover:border-[#E5A024]/60 cursor-pointer disabled:opacity-50"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#E5A024]" />
                )}
                <span>Load Sample Agency Clients</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeView === 'brand' && <BrandMemoryView />}
            {activeView === 'daily' && <DailyAutopilotView />}
            {activeView === 'calendar' && <CalendarStudioView />}
            {activeView === 'captions' && <CaptionStudioView />}
            {activeView === 'reels' && <ReelScriptView />}
            {activeView === 'competitors' && <CompetitorIntelView />}
            {activeView === 'repurpose' && <RepurposeEngineView />}
            {activeView === 'approvals' && <ApprovalPipelineView />}
            {activeView === 'performance' && <PerformanceView />}
          </>
        )}
      </SidebarShell>

      <NewClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StudioProvider>
        <StudioWorkspace />
      </StudioProvider>
    </ErrorBoundary>
  );
}
