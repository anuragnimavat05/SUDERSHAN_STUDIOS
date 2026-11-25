import React, { useState } from 'react';
import { ArrowRight, KeyRound, Layers, ShieldCheck, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const AuthGate: React.FC = () => {
  const { loginWithGoogle, enterDemoWorkspace } = useStudio();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090C10] text-[#E6EDF3] flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-8 border-b border-white/[0.06]">
        <span className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0">
          Sudershan AI
        </span>
        <div className="text-xs text-[#94A3B8] hidden sm:flex items-center gap-2">
          <span>AI Content Studio</span>
          <span aria-hidden="true">·</span>
          <span>Companion for BrightBean Studio</span>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          {signingIn ? 'Signing in...' : 'Sign in'}
        </button>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#E5A024] tracking-wide">
              Multi-Client Agency Content Studio
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#F8FAFC] leading-[1.12] tracking-tight max-w-2xl">
              Brand memory, trilingual creation, and client sign-off before BrightBean Studio.
            </h1>
            <p className="text-base text-[#94A3B8] leading-relaxed max-w-xl">
              Centralize isolated client workspaces, Gujarati, Hindi, and English captions,
              timecoded Instagram Reel scripts, competitor teardowns, and approval revisions—then
              hand off finished assets cleanly to BrightBean Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold rounded-lg bg-[#E5A024] text-[#090C10] hover:bg-[#F0B340] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <span>{signingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={enterDemoWorkspace}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-lg bg-[#131922] text-[#E6EDF3] border border-white/[0.12] hover:bg-[#19212D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Explore Interactive Agency Demo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/[0.08]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F8FAFC]">
                <Layers className="w-4 h-4 text-[#E5A024] shrink-0" />
                <span>Isolated Workspaces</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Separate brand voice memory, calendars, and assets per client with role-scoped access.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F8FAFC]">
                <Sparkles className="w-4 h-4 text-[#E5A024] shrink-0" />
                <span>GU · HI · EN Studio</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Native Gujarati, Hindi Devanagari, and English copy grounded in client memory via Gemini.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F8FAFC]">
                <ShieldCheck className="w-4 h-4 text-[#E5A024] shrink-0" />
                <span>BrightBean Bridge</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Signed webhook handoff and CSV/JSON exports with zero duplicate scheduling or OAuth.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="bg-[#131922] border border-white/[0.08] rounded-xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                Agency Access Architecture
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Role-enforced multi-tenant workspaces backed by Firebase Auth and Cloud Firestore.
              </p>
            </div>

            <div className="divide-y divide-white/[0.07] text-sm">
              <div className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-[#F8FAFC]">Agency Admin</div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Creates client workspaces, manages team & reviewer permissions, and configures BrightBean webhooks.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#E5A024] shrink-0">Full Control</span>
              </div>
              <div className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-[#F8FAFC]">Strategist</div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Curates Brand Memory, generates calendars, multilingual captions, Reel scripts, and competitor briefs.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#94A3B8] shrink-0">Create & Revise</span>
              </div>
              <div className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-[#F8FAFC]">Client Reviewer</div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Inspects assigned client drafts only, requests revisions with notes, and signs off for BrightBean handoff.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#22C55E] shrink-0">Review & Approve</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2.5 text-xs text-[#94A3B8]">
              <KeyRound className="w-4 h-4 text-[#E5A024] shrink-0" />
              <span>Gemini API keys and webhook signing secrets remain strictly server-side.</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs text-[#64748B]">
        <span>Sudershan AI Content Studio</span>
        <span>Built to integrate alongside BrightBean Studio</span>
      </footer>
    </div>
  );
};
