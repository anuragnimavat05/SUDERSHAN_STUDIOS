# Sudershan AI

**Multi-Client AI Content Studio for Social Media Agencies & Brand Teams**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-Server-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Gemini API](https://img.shields.io/badge/Google-Gemini%20API-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)

Sudershan AI is a full-stack, multi-client AI creative and strategy studio built to operate alongside **BrightBean Studio** (or Meta Business Suite). While your publishing platform handles Instagram OAuth, scheduling, and direct publishing, Sudershan AI owns everything upstream and downstream: persistent brand memory, daily research and content creation, native trilingual copywriting (**English, Hindi, and Gujarati**), Reel scripting, competitor teardowns, client approvals, and a closed-loop adaptive planner that turns performance data into next week's strategy.

---

## Table of Contents

- [Key Capabilities](#key-capabilities)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started (Local Setup)](#getting-started-local-setup)
- [Environment Variables](#environment-variables)
- [Firebase & Security Model](#firebase--security-model)
- [API Reference](#api-reference)
- [Scripts & Testing](#scripts--testing)
- [BrightBean Studio & Meta Business Suite Workflow](#brightbean-studio--meta-business-suite-workflow)

---

## Key Capabilities

### 1. Daily Autopilot & Smart Adaptive Loop
- **1-Post-Per-Day Autopilot**: Researches timely audience trends and niche angles (using live Google Search grounding when available on the active API key tier, with automatic fallback to Gemini brand/trend intelligence) and outputs a complete daily Instagram deliverable (**Reel, Carousel, or Static**).
- **7-Day Cadence Tracker**: Visualizes daily coverage and posting streaks across the week.
- **Smart Loop (`Post → Research → Update → New Plan`)**: Reviews recently published posts and logged performance metrics, diagnoses what resonated and what to pivot, proposes selectable **Brand Memory** updates, and builds a fresh **7-day daily plan** that saves directly into the Content Calendar.
- **One-Click Copy Pack**: Copies caption, hashtags, CTA, and visual/script notes formatted for immediate pasting into Meta Business Suite or BrightBean Studio.

### 2. Multi-Client Workspaces & Persistent Brand Memory
- Strict workspace isolation per client brand (`clients/{clientId}`), each with its own industry, markets, summary, default languages, and banned-terms guardrail.
- Structured **Brand Memory** (`voice_rule`, `audience_persona`, `content_pillar`, `cultural_context`, `do_not_use`, `winning_pattern`) automatically injected into every AI generation prompt.

### 3. AI Creation & Intelligence Modules
- **Monthly Content Calendar**: Generates structured monthly calendars with balanced content pillars, formats (`Reel`, `Carousel`, `Static`, `Story`), hooks, and CTA goals.
- **Multilingual Caption Studio**: Writes culturally native copy in **English**, **Hindi (हिन्दी)**, and **Gujarati (ગુજરાતી)**, plus optional romanized **Hinglish** and **Gujlish** variants.
- **Instagram Reel Hooks & Script Lab**: Produces 5 scroll-stopping `0–3s` hooks and timecoded scene-by-scene scripts (visual direction, on-screen text, voiceover, and audio cues).
- **Competitor Content Intelligence**: Analyzes a supplied public URL (via Gemini URL Context) or pasted competitor copy/transcripts to extract hook patterns, content gaps, and counter-angles.
- **AI Repurposing Engine**: Transforms a single blog post, video transcript, or long-form brief into an Instagram Carousel outline, Reel summary, LinkedIn post, Threads sequence, and WhatsApp broadcast.

### 4. Approvals, Analytics & Handoff
- **Approval & Revision Pipeline**: Full editorial workflow (`draft` → `in_review` → `revision_requested` → `approved` → `handed_off`) with immutable revision history and an AI Revision Assistant that rewrites drafts from reviewer notes.
- **Role-Based Access Control (RBAC)**: Supports `Agency Admin`, `Strategist`, and `Client Reviewer` roles enforced both in the UI and in Firestore security rules.
- **Performance Analysis**: Imports or logs post-level reach, likes, comments, saves, shares, and watch time, visualizes engagement trends with Recharts, and generates executive Gemini recommendations.
- **BrightBean Studio Handoff**: Exports approved packs as **JSON** or **CSV**, or dispatches signed **HMAC-SHA256 webhooks** with SSRF URL validation.

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         React 19 + Vite SPA                          │
│  Daily Autopilot • Smart Loop • Calendar • Captions • Reel Scripts   │
│  Competitor Intel • Repurpose • Approvals • Performance Analytics    │
└──────────────────┬─────────────────────────────────┬─────────────────┘
                   │ Firebase SDK (Auth + Firestore) │ HTTPS /api/*
                   ▼                                 ▼
┌────────────────────────────────────┐  ┌──────────────────────────────┐
│      Firebase Auth & Firestore     │  │   Express Server (server.ts) │
│  • Google Sign-In & ID Tokens      │  │  • Firebase ID Token Verify  │
│  • Multi-client RBAC Security Rules│  │  • Sliding-Window Rate Limit │
│  • Real-time Workspace Sync        │  │  • @google/genai Proxy       │
└────────────────────────────────────┘  │  • SSRF-Checked Webhook Sign │
                                        └──────────────┬───────────────┘
                                                       │
                                        ┌──────────────┴───────────────┐
                                        │  Google Gemini API  &        │
                                        │  BrightBean Studio Webhooks  │
                                        └──────────────────────────────┘
```

All Gemini API calls execute exclusively on the Express backend (`server.ts`) so `GEMINI_API_KEY` is never exposed to the browser.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion, Recharts |
| **Backend** | Node.js (20+), Express, `tsx`, `@google/genai` SDK |
| **Database & Auth** | Firebase Authentication (Google Sign-In) & Cloud Firestore |
| **Testing & Quality** | `node:test` (via `tsx --test`), TypeScript (`tsc --noEmit`), ESLint (`@firebase/eslint-plugin-security-rules`) |

---

## Project Structure

```text
.
├── server.ts                      # Express API proxy, Gemini integrations, webhook dispatcher, Vite middleware
├── firebase-blueprint.json        # Firestore entity schemas & collection layout
├── firestore.rules                # Multi-client RBAC Firestore security rules
├── firebase-applet-config.json    # Client-side Firebase Web SDK configuration
├── security_spec.md               # Security architecture notes
├── .env.example                   # Environment variable template
├── src/
│   ├── App.tsx                    # Top-level routing & workspace shell
│   ├── firebase.ts                # Firebase Auth & Firestore initialization
│   ├── context/                   # StudioContext (real-time Firestore state + demo mode)
│   ├── services/                  # Typed API client (studioApi.ts)
│   ├── types/                     # Shared domain TypeScript interfaces (studio.ts)
│   ├── utils/                     # Pure planners, analytics, export, URL safety, and unit tests
│   └── components/
│       ├── DailyAutopilotView.tsx     # 1-post-per-day generator & 7-day cadence strip
│       ├── SmartAdaptiveLoopPanel.tsx # Closed-loop Research → Memory Update → New 7-Day Plan UI
│       ├── BrandMemoryView.tsx        # Client profile & Brand Memory manager
│       ├── CalendarStudioView.tsx     # Monthly content calendar studio
│       ├── CaptionStudioView.tsx      # Trilingual (EN / HI / GU) caption generator
│       ├── ReelScriptView.tsx         # 0–3s hooks & timecoded Reel script lab
│       ├── CompetitorIntelView.tsx    # Competitor URL / copy teardown
│       ├── RepurposeEngineView.tsx    # Multi-channel repurposing studio
│       ├── ApprovalPipelineView.tsx   # Client approval workflow, AI revisions, BrightBean export/webhook
│       ├── PerformanceView.tsx        # Post metrics dashboard & AI insights
│       ├── SidebarShell.tsx           # Workspace switcher & navigation rail
│       ├── NewClientModal.tsx         # Client onboarding modal
│       └── AuthGate.tsx               # Google Sign-In & Demo Mode entry
```

---

## Getting Started (Local Setup)

### Prerequisites
- **Node.js 20+** and **npm**
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)
- *(Optional)* A **Firebase project** with Authentication (Google provider) and Firestore enabled if you want persistent multi-user cloud storage. You can also explore the entire studio immediately in **Demo Mode** without configuring Firebase.

### Installation & Run

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd sudershan-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your `GEMINI_API_KEY` (and optional webhook secret):
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   APP_URL="http://localhost:3000"
   BRIGHTBEAN_WEBHOOK_SECRET=""
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

> **Local Google Sign-In Note:** If you sign in with Google locally using Firebase Authentication, ensure `localhost` is listed under **Firebase Console → Authentication → Settings → Authorized domains** and that `firebase-applet-config.json` points to your Firebase Web app.

---

## Environment Variables

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | Server-side API key used by `server.ts` for all `@google/genai` requests. Never exposed to the client. |
| `APP_URL` | No | Public URL of the deployed app (defaults to `http://localhost:3000` locally). |
| `BRIGHTBEAN_WEBHOOK_SECRET` | No | Optional HMAC-SHA256 signing secret. When set, outbound BrightBean webhooks include an `X-Sudershan-Signature: sha256=<hex>` header. |
| `PORT` | No | Port for the Express server (defaults to `3000`). |

---

## Firebase & Security Model

### Firestore Data Layout
All client data is strictly scoped under `/clients/{clientId}`:
- `/users/{userId}` — Isolated user profiles (`admin`, `strategist`, `client_reviewer`)
- `/clients/{clientId}` — Workspace root, membership list (`memberUids`), and per-member roles (`memberRoles`)
- `/clients/{clientId}/memory/{memoryId}` — Persistent Brand Memory rules
- `/clients/{clientId}/calendars/{calendarId}` — Monthly and 7-day adaptive content plans
- `/clients/{clientId}/assets/{assetId}` — Drafts, scripts, caption packs, and approval states
- `/clients/{clientId}/revisions/{revisionId}` — Immutable approval & revision audit log
- `/clients/{clientId}/competitors/{reportId}` — Saved competitor intelligence reports
- `/clients/{clientId}/metrics/{metricId}` — Post-level performance metrics
- `/clients/{clientId}/insights/{insightId}` — Saved AI performance reports

### Security Controls
- **Server-Side Token Verification**: Authenticated `/api/ai/*` and `/api/integrations/brightbean/handoff` calls verify Firebase Bearer ID tokens against Google Identity Toolkit.
- **Rate Limiting**: Built-in sliding-window IP rate limiter protects AI endpoints.
- **SSRF Protection**: All competitor URLs and outbound BrightBean webhook URLs are validated by `src/utils/urlSafety.ts` to block private IPs, localhost, and non-HTTP(S) schemes.
- **Hardened Firestore Rules**: `firestore.rules` enforces workspace membership, role permissions, and document field validation, verified via `@firebase/eslint-plugin-security-rules`.

---

## API Reference

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health and Gemini configuration status |
| `POST` | `/api/ai/daily-autopilot` | Daily trend research + 1-post-per-day deliverable pack (Reel / Carousel / Static) |
| `POST` | `/api/ai/adaptive-plan` | Smart Loop: performance diagnosis + Brand Memory suggestions + new 7-day plan |
| `POST` | `/api/ai/calendar` | Monthly content calendar generation |
| `POST` | `/api/ai/captions` | Native English, Hindi, Gujarati (+ Hinglish/Gujlish) caption generation |
| `POST` | `/api/ai/reel-script` | 0–3s Reel hooks and timecoded production script |
| `POST` | `/api/ai/competitor-analysis` | Competitor URL or copy teardown with counter-angles |
| `POST` | `/api/ai/repurpose` | Multi-channel content repurposing kit |
| `POST` | `/api/ai/revise` | AI copy revision from client reviewer feedback |
| `POST` | `/api/ai/performance-insights` | Quantitative performance analysis and next-month experiment |
| `POST` | `/api/integrations/brightbean/handoff` | Authenticated, SSRF-checked, HMAC-signed outbound webhook dispatch |

---

## Scripts & Testing

```bash
# Run full-stack dev server (Express + Vite middleware on port 3000)
npm run dev

# Build production frontend bundle (outputs to dist/)
npm run build

# Start production server (set NODE_ENV=production)
NODE_ENV=production npm start

# TypeScript static typecheck
npm run lint

# Run pure logic unit tests (daily planner, adaptive slots, URL safety, metrics, export)
npx tsx --test src/utils/studio.test.ts

# Lint Firestore security rules
npx eslint firestore.rules
```

---

## BrightBean Studio & Meta Business Suite Workflow

Sudershan AI intentionally does **not** duplicate Instagram OAuth or direct social publishing:

1. **Plan & Generate** daily or monthly content in **Sudershan AI** grounded in your client's Brand Memory.
2. **Review & Approve** with team members or clients inside the **Approval Pipeline**.
3. **Hand Off to Publish**:
   - **BrightBean Studio**: Send approved assets via signed webhook (`POST /api/integrations/brightbean/handoff`) or download structured **JSON / CSV** handoff files.
   - **Meta Business Suite**: Use **Copy Meta / BrightBean Pack** in Daily Autopilot to paste the finalized caption, hashtags, CTA, and visual notes directly into Meta Business Suite for scheduling.
4. **Measure & Adapt**: Log or import post results in **Performance Analytics**, then run the **Smart Loop** to update Brand Memory and generate next week's optimized 7-day plan.
