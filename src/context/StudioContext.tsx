import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from '../firebase';
import { createSeedBundle, type SeedBundle } from '../data/seedData';
import type {
  AgencyRole,
  AssetRevision,
  AssetStatus,
  BrandContextPayload,
  BrandMemoryItem,
  BrightBeanStatus,
  ClientWorkspace,
  CompetitorReport,
  ContentAsset,
  MemberDirectoryEntry,
  MonthlyCalendar,
  PerformanceMetric,
  PerformanceRecommendation,
  StudioView,
} from '../types/studio';
import { canTransitionAssetStatus, getRolePermissions, type RolePermissions } from '../utils/workflow';

export interface StudioSessionUser {
  uid: string;
  email: string;
  displayName: string;
  agencyRole: AgencyRole;
  isDemo: boolean;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface StudioContextValue {
  authReady: boolean;
  sessionUser: StudioSessionUser | null;
  isDemoMode: boolean;
  activeView: StudioView;
  setActiveView: (view: StudioView) => void;
  clients: ClientWorkspace[];
  activeClientId: string | null;
  activeClient: ClientWorkspace | null;
  setActiveClientId: (clientId: string) => void;
  effectiveRole: AgencyRole;
  permissions: RolePermissions;
  demoRoleOverride: AgencyRole | null;
  setDemoRoleOverride: (role: AgencyRole | null) => void;

  // Scoped active client data
  memoryItems: BrandMemoryItem[];
  calendars: MonthlyCalendar[];
  assets: ContentAsset[];
  revisions: AssetRevision[];
  competitors: CompetitorReport[];
  metrics: PerformanceMetric[];
  insights: PerformanceRecommendation[];
  brandContext: BrandContextPayload;
  loadingClientData: boolean;

  // Cross-view draft prefill (e.g. Calendar Slot -> Caption/Reel Studio)
  draftSeedTopic: string;
  draftSeedPillar: string;
  launchFromCalendarSlot: (target: 'captions' | 'reels', topic: string, pillar: string) => void;
  clearDraftSeed: () => void;

  // Auth & Workspace controls
  loginWithGoogle: () => Promise<void>;
  enterDemoWorkspace: () => void;
  logout: () => Promise<void>;
  seedStarterWorkspaces: () => Promise<void>;

  // Mutations
  createClientWorkspace: (input: {
    name: string;
    industry: string;
    website: string;
    primaryMarkets: string;
    brandSummary: string;
    bannedTerms: string;
    defaultLanguages: string[];
    brightBeanWorkspaceId: string;
    brightBeanWebhookUrl: string;
  }) => Promise<void>;
  updateClientWorkspace: (clientId: string, patch: Partial<ClientWorkspace>) => Promise<void>;
  addClientMember: (member: { name: string; email: string; uid: string; role: AgencyRole }) => Promise<void>;
  removeClientMember: (uid: string) => Promise<void>;
  addMemoryItem: (item: {
    category: BrandMemoryItem['category'];
    title: string;
    detail: string;
    languageScope: BrandMemoryItem['languageScope'];
  }) => Promise<void>;
  deleteMemoryItem: (memoryId: string) => Promise<void>;
  saveMonthlyCalendar: (calendar: Omit<MonthlyCalendar, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  saveContentAsset: (
    asset: Omit<
      ContentAsset,
      'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt' | 'updatedAt' | 'version' | 'brightBeanStatus'
    >
  ) => Promise<string>;
  updateAssetContent: (
    assetId: string,
    patch: Partial<Pick<ContentAsset, 'title' | 'captions' | 'hashtags' | 'cta' | 'reelHooks' | 'reelScenes' | 'repurposedOutputs'>>,
    revisionNote: string
  ) => Promise<void>;
  transitionAssetStatus: (
    assetId: string,
    nextStatus: AssetStatus,
    note: string,
    handoffPatch?: { brightBeanStatus?: BrightBeanStatus; brightBeanReference?: string }
  ) => Promise<void>;
  saveCompetitorReport: (
    report: Omit<CompetitorReport, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'>
  ) => Promise<void>;
  addPerformanceMetrics: (
    rows: Array<Omit<PerformanceMetric, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'>>
  ) => Promise<void>;
  savePerformanceInsight: (
    insight: Omit<PerformanceRecommendation, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'>
  ) => Promise<void>;

  // Notifications
  toast: ToastMessage | null;
  notify: (tone: ToastMessage['tone'], text: string) => void;
  dismissToast: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [demoRoleOverride, setDemoRoleOverride] = useState<AgencyRole | null>(null);
  const [activeView, setActiveView] = useState<StudioView>('brand');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [loadingClientData, setLoadingClientData] = useState(false);

  // Live Firestore state
  const [liveUserRole, setLiveUserRole] = useState<AgencyRole>('strategist');
  const [liveClients, setLiveClients] = useState<ClientWorkspace[]>([]);
  const [liveMemory, setLiveMemory] = useState<BrandMemoryItem[]>([]);
  const [liveCalendars, setLiveCalendars] = useState<MonthlyCalendar[]>([]);
  const [liveAssets, setLiveAssets] = useState<ContentAsset[]>([]);
  const [liveRevisions, setLiveRevisions] = useState<AssetRevision[]>([]);
  const [liveCompetitors, setLiveCompetitors] = useState<CompetitorReport[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<PerformanceMetric[]>([]);
  const [liveInsights, setLiveInsights] = useState<PerformanceRecommendation[]>([]);

  // Demo state
  const [demoStore, setDemoStore] = useState<SeedBundle>(() =>
    createSeedBundle('demo-admin-uid', 'Anurag Nimavat', BOOTSTRAP_ADMIN_EMAIL)
  );

  // Cross-view draft prefill
  const [draftSeedTopic, setDraftSeedTopic] = useState('');
  const [draftSeedPillar, setDraftSeedPillar] = useState('');

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = makeSafeId('toast');
    setToast({ id, tone, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsDemoMode(false);
        const isBootstrap = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        const defaultRole: AgencyRole = isBootstrap ? 'admin' : 'strategist';
        try {
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const role = snap.data().agencyRole as AgencyRole;
            setLiveUserRole(role || defaultRole);
          } else {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email || 'user@sudershan.ai',
              displayName: (user.displayName || user.email?.split('@')[0] || 'Agency Member').slice(0, 120),
              agencyRole: defaultRole,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setLiveUserRole(defaultRole);
          }
        } catch (err) {
          console.error('User profile bootstrap error:', err);
          setLiveUserRole(defaultRole);
        }
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to Clients list when authenticated
  useEffect(() => {
    if (!firebaseUser || isDemoMode) {
      setLiveClients([]);
      return;
    }

    const q = query(collection(db, 'clients'), where('memberUids', 'array-contains', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: ClientWorkspace[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            monogram: String(data.monogram || 'CL'),
            industry: String(data.industry || ''),
            website: String(data.website || ''),
            primaryMarkets: String(data.primaryMarkets || ''),
            brandSummary: String(data.brandSummary || ''),
            bannedTerms: String(data.bannedTerms || ''),
            defaultLanguages: Array.isArray(data.defaultLanguages) ? data.defaultLanguages : ['en'],
            brightBeanWorkspaceId: String(data.brightBeanWorkspaceId || ''),
            brightBeanWebhookUrl: String(data.brightBeanWebhookUrl || ''),
            ownerUid: String(data.ownerUid || ''),
            memberUids: Array.isArray(data.memberUids) ? data.memberUids : [firebaseUser.uid],
            memberRoles: (data.memberRoles as Record<string, AgencyRole>) || {},
            memberDirectory: Array.isArray(data.memberDirectory) ? data.memberDirectory : [],
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setLiveClients(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clients')
    );

    return () => unsub();
  }, [firebaseUser, isDemoMode]);

  const clients = isDemoMode ? demoStore.clients : liveClients;

  // Keep activeClientId synchronized
  useEffect(() => {
    if (clients.length === 0) {
      setActiveClientId(null);
      return;
    }
    if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
      setActiveClientId(clients[0].id);
    }
  }, [clients, activeClientId]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  // Subscribe to Active Client Subcollections in Live Mode
  useEffect(() => {
    if (!firebaseUser || isDemoMode || !activeClientId) {
      setLiveMemory([]);
      setLiveCalendars([]);
      setLiveAssets([]);
      setLiveRevisions([]);
      setLiveCompetitors([]);
      setLiveMetrics([]);
      setLiveInsights([]);
      return;
    }

    setLoadingClientData(true);
    const uid = firebaseUser.uid;
    const base = `clients/${activeClientId}`;

    const unsubs = [
      onSnapshot(
        query(collection(db, `${base}/memory`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          setLiveMemory(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<BrandMemoryItem, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
              updatedAt: toIsoString(d.data().updatedAt),
            }))
          );
          setLoadingClientData(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/memory`)
      ),
      onSnapshot(
        query(collection(db, `${base}/calendars`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          setLiveCalendars(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<MonthlyCalendar, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
              updatedAt: toIsoString(d.data().updatedAt),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/calendars`)
      ),
      onSnapshot(
        query(collection(db, `${base}/assets`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              ...(d.data() as Omit<ContentAsset, 'id'>),
              id: d.id,
              brightBeanStatus: (d.data().brightBeanStatus as BrightBeanStatus) || 'pending',
              createdAt: toIsoString(d.data().createdAt),
              updatedAt: toIsoString(d.data().updatedAt),
            }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          setLiveAssets(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/assets`)
      ),
      onSnapshot(
        query(collection(db, `${base}/revisions`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              ...(d.data() as Omit<AssetRevision, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setLiveRevisions(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/revisions`)
      ),
      onSnapshot(
        query(collection(db, `${base}/competitors`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              ...(d.data() as Omit<CompetitorReport, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setLiveCompetitors(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/competitors`)
      ),
      onSnapshot(
        query(collection(db, `${base}/metrics`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              ...(d.data() as Omit<PerformanceMetric, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
            }))
            .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
          setLiveMetrics(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/metrics`)
      ),
      onSnapshot(
        query(collection(db, `${base}/insights`), where('memberUids', 'array-contains', uid)),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              ...(d.data() as Omit<PerformanceRecommendation, 'id'>),
              id: d.id,
              createdAt: toIsoString(d.data().createdAt),
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setLiveInsights(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `${base}/insights`)
      ),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [firebaseUser, isDemoMode, activeClientId]);

  const sessionUser: StudioSessionUser | null = useMemo(() => {
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Agency User',
        agencyRole: liveUserRole,
        isDemo: false,
      };
    }
    if (isDemoMode) {
      return {
        uid: 'demo-admin-uid',
        email: BOOTSTRAP_ADMIN_EMAIL,
        displayName: 'Anurag Nimavat',
        agencyRole: demoRoleOverride || 'admin',
        isDemo: true,
      };
    }
    return null;
  }, [firebaseUser, liveUserRole, isDemoMode, demoRoleOverride]);

  const effectiveRole: AgencyRole = useMemo(() => {
    if (!sessionUser) return 'client_reviewer';
    if (isDemoMode) return demoRoleOverride || 'admin';
    if (sessionUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) return 'admin';
    if (activeClient) {
      if (activeClient.ownerUid === sessionUser.uid) return 'admin';
      return activeClient.memberRoles[sessionUser.uid] || sessionUser.agencyRole;
    }
    return sessionUser.agencyRole;
  }, [sessionUser, isDemoMode, demoRoleOverride, activeClient]);

  const permissions = useMemo(() => getRolePermissions(effectiveRole), [effectiveRole]);

  const memoryItems = isDemoMode
    ? (activeClientId ? demoStore.memoryByClient[activeClientId] || [] : [])
    : liveMemory;
  const calendars = isDemoMode
    ? (activeClientId ? demoStore.calendarsByClient[activeClientId] || [] : [])
    : liveCalendars;
  const assets = isDemoMode
    ? (activeClientId ? demoStore.assetsByClient[activeClientId] || [] : [])
    : liveAssets;
  const revisions = isDemoMode
    ? (activeClientId ? demoStore.revisionsByClient[activeClientId] || [] : [])
    : liveRevisions;
  const competitors = isDemoMode
    ? (activeClientId ? demoStore.competitorsByClient[activeClientId] || [] : [])
    : liveCompetitors;
  const metrics = isDemoMode
    ? (activeClientId ? demoStore.metricsByClient[activeClientId] || [] : [])
    : liveMetrics;
  const insights = isDemoMode
    ? (activeClientId ? demoStore.insightsByClient[activeClientId] || [] : [])
    : liveInsights;

  const brandContext: BrandContextPayload = useMemo(() => {
    if (!activeClient) {
      return {
        name: 'Sudershan Agency Client',
        industry: 'Social Media Brand',
        primaryMarkets: 'India',
        brandSummary: '',
        bannedTerms: '',
        defaultLanguages: ['en', 'hi', 'gu'],
        memory: [],
      };
    }
    return {
      name: activeClient.name,
      industry: activeClient.industry,
      primaryMarkets: activeClient.primaryMarkets,
      brandSummary: activeClient.brandSummary,
      bannedTerms: activeClient.bannedTerms,
      defaultLanguages: activeClient.defaultLanguages,
      memory: memoryItems.map((m) => ({
        category: m.category,
        title: m.title,
        detail: m.detail,
        languageScope: m.languageScope,
      })),
    };
  }, [activeClient, memoryItems]);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
      notify('success', 'Signed in with Google. Syncing Firestore workspaces.');
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.'
      );
    }
  }, [notify]);

  const enterDemoWorkspace = useCallback(() => {
    setIsDemoMode(true);
    notify('info', 'Entered Interactive Agency Demo with sample multi-client workspaces.');
  }, [notify]);

  const logout = useCallback(async () => {
    if (firebaseUser) {
      await signOutUser();
    }
    setIsDemoMode(false);
    setDemoRoleOverride(null);
    setActiveClientId(null);
    notify('info', 'Signed out of Sudershan AI.');
  }, [firebaseUser, notify]);

  const seedStarterWorkspaces = useCallback(async () => {
    if (!sessionUser) return;
    const bundle = createSeedBundle(sessionUser.uid, sessionUser.displayName, sessionUser.email);

    if (isDemoMode) {
      setDemoStore(bundle);
      setActiveClientId(bundle.clients[0].id);
      notify('success', 'Reset starter agency clients (Aaranya Looms & Prana Botanics).');
      return;
    }

    try {
      // Batch 1: Create parent client workspace documents first so Firestore
      // security rules' exists()/get() parent checks succeed for all verified users.
      const clientsBatch = writeBatch(db);
      const seededClientPairs: Array<{ seedClientId: string; firestoreClientId: string }> = [];

      for (const client of bundle.clients) {
        const clientId = makeSafeId(client.id.slice(0, 12));
        seededClientPairs.push({ seedClientId: client.id, firestoreClientId: clientId });
        const clientRef = doc(db, 'clients', clientId);
        clientsBatch.set(clientRef, {
          name: client.name.slice(0, 120),
          monogram: client.monogram.slice(0, 4),
          industry: client.industry.slice(0, 100),
          website: client.website.slice(0, 300),
          primaryMarkets: client.primaryMarkets.slice(0, 200),
          brandSummary: client.brandSummary.slice(0, 2000),
          bannedTerms: client.bannedTerms.slice(0, 500),
          defaultLanguages: client.defaultLanguages.slice(0, 5),
          brightBeanWorkspaceId: client.brightBeanWorkspaceId.slice(0, 120),
          brightBeanWebhookUrl: '',
          ownerUid: sessionUser.uid,
          memberUids: [sessionUser.uid],
          memberRoles: { [sessionUser.uid]: 'admin' },
          memberDirectory: [
            {
              uid: sessionUser.uid,
              name: sessionUser.displayName,
              email: sessionUser.email,
              role: 'admin',
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await clientsBatch.commit();

      // Batch 2: Populate isolated child subcollections now that parent workspaces exist.
      const childrenBatch = writeBatch(db);
      for (const { seedClientId, firestoreClientId: clientId } of seededClientPairs) {
        for (const mem of bundle.memoryByClient[seedClientId] || []) {
          childrenBatch.set(doc(db, `clients/${clientId}/memory`, makeSafeId('mem')), {
            clientId,
            category: mem.category,
            title: mem.title.slice(0, 140),
            detail: mem.detail.slice(0, 2000),
            languageScope: mem.languageScope,
            authorUid: sessionUser.uid,
            memberUids: [sessionUser.uid],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const cal of bundle.calendarsByClient[seedClientId] || []) {
          childrenBatch.set(doc(db, `clients/${clientId}/calendars`, makeSafeId('cal')), {
            clientId,
            monthLabel: cal.monthLabel.slice(0, 60),
            objective: cal.objective.slice(0, 400),
            cadencePerWeek: cal.cadencePerWeek,
            slots: cal.slots.slice(0, 35),
            authorUid: sessionUser.uid,
            memberUids: [sessionUser.uid],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const assetIdMap = new Map<string, string>();
        for (const asset of bundle.assetsByClient[seedClientId] || []) {
          const assetId = makeSafeId('asset');
          assetIdMap.set(asset.id, assetId);
          childrenBatch.set(
            doc(db, `clients/${clientId}/assets`, assetId),
            stripUndefined({
              clientId,
              title: asset.title.slice(0, 160),
              assetType: asset.assetType,
              platform: asset.platform.slice(0, 60),
              pillar: asset.pillar.slice(0, 100),
              status: asset.status === 'draft' ? 'draft' : 'in_review',
              version: asset.version,
              languages: asset.languages.slice(0, 5),
              captions: asset.captions,
              hashtags: asset.hashtags?.slice(0, 30),
              cta: asset.cta?.slice(0, 300),
              reelHooks: asset.reelHooks?.slice(0, 10),
              reelScenes: asset.reelScenes?.slice(0, 25),
              repurposedOutputs: asset.repurposedOutputs,
              reviewerNote: asset.reviewerNote?.slice(0, 1500),
              brightBeanStatus: 'pending',
              authorUid: sessionUser.uid,
              memberUids: [sessionUser.uid],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        for (const rev of bundle.revisionsByClient[seedClientId] || []) {
          const mappedAssetId = assetIdMap.get(rev.assetId);
          if (!mappedAssetId) continue;
          childrenBatch.set(doc(db, `clients/${clientId}/revisions`, makeSafeId('rev')), {
            clientId,
            assetId: mappedAssetId,
            version: rev.version,
            action: rev.action,
            note: rev.note.slice(0, 1500),
            actorName: rev.actorName.slice(0, 120),
            actorRole: rev.actorRole,
            authorUid: sessionUser.uid,
            memberUids: [sessionUser.uid],
            createdAt: serverTimestamp(),
          });
        }

        for (const comp of bundle.competitorsByClient[seedClientId] || []) {
          childrenBatch.set(
            doc(db, `clients/${clientId}/competitors`, makeSafeId('comp')),
            stripUndefined({
              clientId,
              competitorName: comp.competitorName.slice(0, 120),
              sourceUrl: comp.sourceUrl?.slice(0, 400),
              summary: comp.summary.slice(0, 2000),
              hookPatterns: comp.hookPatterns.slice(0, 15),
              contentGaps: comp.contentGaps.slice(0, 15),
              counterAngles: comp.counterAngles.slice(0, 15),
              authorUid: sessionUser.uid,
              memberUids: [sessionUser.uid],
              createdAt: serverTimestamp(),
            })
          );
        }

        for (const metric of bundle.metricsByClient[seedClientId] || []) {
          childrenBatch.set(
            doc(db, `clients/${clientId}/metrics`, makeSafeId('met')),
            stripUndefined({
              clientId,
              postTitle: metric.postTitle.slice(0, 160),
              publishedDate: metric.publishedDate.slice(0, 30),
              format: metric.format,
              language: metric.language,
              pillar: metric.pillar.slice(0, 100),
              reach: metric.reach,
              likes: metric.likes,
              comments: metric.comments,
              saves: metric.saves,
              shares: metric.shares,
              avgWatchSec: metric.avgWatchSec,
              authorUid: sessionUser.uid,
              memberUids: [sessionUser.uid],
              createdAt: serverTimestamp(),
            })
          );
        }

        for (const insight of bundle.insightsByClient[seedClientId] || []) {
          childrenBatch.set(
            doc(db, `clients/${clientId}/insights`, makeSafeId('ins')),
            stripUndefined({
              clientId,
              headline: insight.headline.slice(0, 180),
              executiveSummary: insight.executiveSummary.slice(0, 2000),
              doubleDown: insight.doubleDown.slice(0, 12),
              adjustments: insight.adjustments.slice(0, 12),
              nextMonthExperiment: insight.nextMonthExperiment?.slice(0, 800),
              authorUid: sessionUser.uid,
              memberUids: [sessionUser.uid],
              createdAt: serverTimestamp(),
            })
          );
        }
      }

      await childrenBatch.commit();
      notify('success', 'Starter client workspaces seeded to Cloud Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clients');
    }
  }, [sessionUser, isDemoMode, notify]);

  const createClientWorkspace = useCallback(
    async (input: {
      name: string;
      industry: string;
      website: string;
      primaryMarkets: string;
      brandSummary: string;
      bannedTerms: string;
      defaultLanguages: string[];
      brightBeanWorkspaceId: string;
      brightBeanWebhookUrl: string;
    }) => {
      if (!sessionUser) return;
      const monogram = input.name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'CL';

      const clientId = makeSafeId('client');
      const memberDirectory: MemberDirectoryEntry[] = [
        {
          uid: sessionUser.uid,
          name: sessionUser.displayName,
          email: sessionUser.email,
          role: 'admin',
        },
      ];

      const newClient: ClientWorkspace = {
        id: clientId,
        name: input.name.trim().slice(0, 120),
        monogram,
        industry: input.industry.trim().slice(0, 100),
        website: input.website.trim().slice(0, 300),
        primaryMarkets: input.primaryMarkets.trim().slice(0, 200),
        brandSummary: input.brandSummary.trim().slice(0, 2000),
        bannedTerms: input.bannedTerms.trim().slice(0, 500),
        defaultLanguages: input.defaultLanguages.length ? input.defaultLanguages.slice(0, 5) : ['en'],
        brightBeanWorkspaceId: input.brightBeanWorkspaceId.trim().slice(0, 120),
        brightBeanWebhookUrl: input.brightBeanWebhookUrl.trim().slice(0, 400),
        ownerUid: sessionUser.uid,
        memberUids: [sessionUser.uid],
        memberRoles: { [sessionUser.uid]: 'admin' },
        memberDirectory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          clients: [newClient, ...prev.clients],
          memoryByClient: { ...prev.memoryByClient, [clientId]: [] },
          calendarsByClient: { ...prev.calendarsByClient, [clientId]: [] },
          assetsByClient: { ...prev.assetsByClient, [clientId]: [] },
          revisionsByClient: { ...prev.revisionsByClient, [clientId]: [] },
          competitorsByClient: { ...prev.competitorsByClient, [clientId]: [] },
          metricsByClient: { ...prev.metricsByClient, [clientId]: [] },
          insightsByClient: { ...prev.insightsByClient, [clientId]: [] },
        }));
        setActiveClientId(clientId);
        notify('success', `Created isolated client workspace "${newClient.name}".`);
        return;
      }

      try {
        await setDoc(doc(db, 'clients', clientId), {
          name: newClient.name,
          monogram: newClient.monogram,
          industry: newClient.industry,
          website: newClient.website,
          primaryMarkets: newClient.primaryMarkets,
          brandSummary: newClient.brandSummary,
          bannedTerms: newClient.bannedTerms,
          defaultLanguages: newClient.defaultLanguages,
          brightBeanWorkspaceId: newClient.brightBeanWorkspaceId,
          brightBeanWebhookUrl: newClient.brightBeanWebhookUrl,
          ownerUid: newClient.ownerUid,
          memberUids: newClient.memberUids,
          memberRoles: newClient.memberRoles,
          memberDirectory: newClient.memberDirectory,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setActiveClientId(clientId);
        notify('success', `Created client workspace "${newClient.name}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `clients/${clientId}`);
      }
    },
    [sessionUser, isDemoMode, notify]
  );

  const updateClientWorkspace = useCallback(
    async (clientId: string, patch: Partial<ClientWorkspace>) => {
      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          clients: prev.clients.map((c) =>
            c.id === clientId ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
          ),
        }));
        notify('success', 'Client profile and BrightBean configuration saved.');
        return;
      }

      try {
        const clean = stripUndefined({
          name: patch.name?.slice(0, 120),
          industry: patch.industry?.slice(0, 100),
          website: patch.website?.slice(0, 300),
          primaryMarkets: patch.primaryMarkets?.slice(0, 200),
          brandSummary: patch.brandSummary?.slice(0, 2000),
          bannedTerms: patch.bannedTerms?.slice(0, 500),
          defaultLanguages: patch.defaultLanguages?.slice(0, 5),
          brightBeanWorkspaceId: patch.brightBeanWorkspaceId?.slice(0, 120),
          brightBeanWebhookUrl: patch.brightBeanWebhookUrl?.slice(0, 400),
          memberUids: patch.memberUids?.slice(0, 25),
          memberRoles: patch.memberRoles,
          memberDirectory: patch.memberDirectory?.slice(0, 25),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'clients', clientId), clean);
        notify('success', 'Client profile saved to Firestore.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${clientId}`);
      }
    },
    [isDemoMode, notify]
  );

  const addClientMember = useCallback(
    async (member: { name: string; email: string; uid: string; role: AgencyRole }) => {
      if (!activeClient) return;
      const cleanUid = member.uid.trim().replace(/[^a-zA-Z0-9_-]/g, '') || makeSafeId('member');
      const nextUids = Array.from(new Set([...activeClient.memberUids, cleanUid])).slice(0, 25);
      const nextRoles: Record<string, AgencyRole> = {
        ...activeClient.memberRoles,
        [cleanUid]: member.role,
      };
      const nextDir: MemberDirectoryEntry[] = [
        ...activeClient.memberDirectory.filter((m) => m.uid !== cleanUid),
        {
          uid: cleanUid,
          name: member.name.trim().slice(0, 120),
          email: member.email.trim().slice(0, 200),
          role: member.role,
        },
      ].slice(0, 25);

      await updateClientWorkspace(activeClient.id, {
        memberUids: nextUids,
        memberRoles: nextRoles,
        memberDirectory: nextDir,
      });
    },
    [activeClient, updateClientWorkspace]
  );

  const removeClientMember = useCallback(
    async (uid: string) => {
      if (!activeClient || uid === activeClient.ownerUid) return;
      const nextUids = activeClient.memberUids.filter((id) => id !== uid);
      const nextRoles = { ...activeClient.memberRoles };
      delete nextRoles[uid];
      const nextDir = activeClient.memberDirectory.filter((m) => m.uid !== uid);
      await updateClientWorkspace(activeClient.id, {
        memberUids: nextUids,
        memberRoles: nextRoles,
        memberDirectory: nextDir,
      });
    },
    [activeClient, updateClientWorkspace]
  );

  const addMemoryItem = useCallback(
    async (item: {
      category: BrandMemoryItem['category'];
      title: string;
      detail: string;
      languageScope: BrandMemoryItem['languageScope'];
    }) => {
      if (!activeClient || !sessionUser) return;
      const memoryId = makeSafeId('mem');
      const record: BrandMemoryItem = {
        id: memoryId,
        clientId: activeClient.id,
        category: item.category,
        title: item.title.trim().slice(0, 140),
        detail: item.detail.trim().slice(0, 2000),
        languageScope: item.languageScope,
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          memoryByClient: {
            ...prev.memoryByClient,
            [activeClient.id]: [record, ...(prev.memoryByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Saved "${record.title}" to Brand Memory.`);
        return;
      }

      try {
        await setDoc(doc(db, `clients/${activeClient.id}/memory`, memoryId), {
          clientId: record.clientId,
          category: record.category,
          title: record.title,
          detail: record.detail,
          languageScope: record.languageScope,
          authorUid: record.authorUid,
          memberUids: record.memberUids,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', `Saved "${record.title}" to Brand Memory.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `clients/${activeClient.id}/memory/${memoryId}`);
      }
    },
    [activeClient, sessionUser, isDemoMode, notify]
  );

  const deleteMemoryItem = useCallback(
    async (memoryId: string) => {
      if (!activeClient) return;
      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          memoryByClient: {
            ...prev.memoryByClient,
            [activeClient.id]: (prev.memoryByClient[activeClient.id] || []).filter(
              (m) => m.id !== memoryId
            ),
          },
        }));
        notify('info', 'Removed memory rule.');
        return;
      }

      try {
        await deleteDoc(doc(db, `clients/${activeClient.id}/memory`, memoryId));
        notify('info', 'Removed memory rule.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `clients/${activeClient.id}/memory/${memoryId}`);
      }
    },
    [activeClient, isDemoMode, notify]
  );

  const saveMonthlyCalendar = useCallback(
    async (
      calendar: Omit<
        MonthlyCalendar,
        'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt' | 'updatedAt'
      >
    ) => {
      if (!activeClient || !sessionUser) return;
      const calId = makeSafeId('cal');
      const record: MonthlyCalendar = {
        ...calendar,
        id: calId,
        clientId: activeClient.id,
        monthLabel: calendar.monthLabel.slice(0, 60),
        objective: calendar.objective.slice(0, 400),
        slots: calendar.slots.slice(0, 35),
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          calendarsByClient: {
            ...prev.calendarsByClient,
            [activeClient.id]: [record, ...(prev.calendarsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Saved ${record.monthLabel} content calendar.`);
        return;
      }

      try {
        await setDoc(doc(db, `clients/${activeClient.id}/calendars`, calId), {
          clientId: record.clientId,
          monthLabel: record.monthLabel,
          objective: record.objective,
          cadencePerWeek: record.cadencePerWeek,
          slots: record.slots,
          authorUid: record.authorUid,
          memberUids: record.memberUids,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', `Saved ${record.monthLabel} calendar to Firestore.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `clients/${activeClient.id}/calendars/${calId}`);
      }
    },
    [activeClient, sessionUser, isDemoMode, notify]
  );

  const saveContentAsset = useCallback(
    async (
      input: Omit<
        ContentAsset,
        'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt' | 'updatedAt' | 'version' | 'brightBeanStatus'
      >
    ): Promise<string> => {
      if (!activeClient || !sessionUser) return '';
      const assetId = makeSafeId('asset');
      const revId = makeSafeId('rev');
      const nowIso = new Date().toISOString();
      const safeStatus: AssetStatus = input.status === 'in_review' ? 'in_review' : 'draft';

      const record: ContentAsset = {
        ...input,
        id: assetId,
        clientId: activeClient.id,
        title: input.title.trim().slice(0, 160),
        platform: input.platform.slice(0, 60),
        pillar: (input.pillar || 'General').slice(0, 100),
        status: safeStatus,
        version: 1,
        languages: input.languages.length ? input.languages.slice(0, 5) : ['en'],
        brightBeanStatus: 'pending',
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const revRecord: AssetRevision = {
        id: revId,
        clientId: activeClient.id,
        assetId,
        version: 1,
        action: safeStatus === 'in_review' ? 'submitted' : 'created',
        note:
          safeStatus === 'in_review'
            ? 'Created in AI Studio and submitted directly for client review.'
            : 'Saved draft to Approval Pipeline.',
        actorName: sessionUser.displayName,
        actorRole: effectiveRole,
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          assetsByClient: {
            ...prev.assetsByClient,
            [activeClient.id]: [record, ...(prev.assetsByClient[activeClient.id] || [])],
          },
          revisionsByClient: {
            ...prev.revisionsByClient,
            [activeClient.id]: [revRecord, ...(prev.revisionsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Saved "${record.title}" to the Approval Pipeline.`);
        return assetId;
      }

      try {
        await setDoc(
          doc(db, `clients/${activeClient.id}/assets`, assetId),
          stripUndefined({
            clientId: record.clientId,
            title: record.title,
            assetType: record.assetType,
            platform: record.platform,
            pillar: record.pillar,
            status: record.status,
            version: record.version,
            languages: record.languages,
            captions: record.captions,
            hashtags: record.hashtags?.slice(0, 30),
            cta: record.cta?.slice(0, 300),
            reelHooks: record.reelHooks?.slice(0, 10),
            reelScenes: record.reelScenes?.slice(0, 25),
            repurposedOutputs: record.repurposedOutputs,
            reviewerNote: record.reviewerNote?.slice(0, 1500),
            brightBeanStatus: record.brightBeanStatus,
            authorUid: record.authorUid,
            memberUids: record.memberUids,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        await setDoc(doc(db, `clients/${activeClient.id}/revisions`, revId), {
          clientId: revRecord.clientId,
          assetId: revRecord.assetId,
          version: revRecord.version,
          action: revRecord.action,
          note: revRecord.note,
          actorName: revRecord.actorName,
          actorRole: revRecord.actorRole,
          authorUid: revRecord.authorUid,
          memberUids: revRecord.memberUids,
          createdAt: serverTimestamp(),
        });
        notify('success', `Saved "${record.title}" to Firestore.`);
        return assetId;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `clients/${activeClient.id}/assets/${assetId}`);
      }
    },
    [activeClient, sessionUser, effectiveRole, isDemoMode, notify]
  );

  const updateAssetContent = useCallback(
    async (
      assetId: string,
      patch: Partial<
        Pick<
          ContentAsset,
          'title' | 'captions' | 'hashtags' | 'cta' | 'reelHooks' | 'reelScenes' | 'repurposedOutputs'
        >
      >,
      revisionNote: string
    ) => {
      if (!activeClient || !sessionUser) return;
      const existingAsset = assets.find((a) => a.id === assetId);
      if (!existingAsset) return;
      const nextVersion = existingAsset.version + 1;
      const nextStatus: AssetStatus =
        existingAsset.status === 'revision_requested' ? 'in_review' : existingAsset.status;
      const revId = makeSafeId('rev');
      const nowIso = new Date().toISOString();

      const revRecord: AssetRevision = {
        id: revId,
        clientId: activeClient.id,
        assetId,
        version: nextVersion,
        action: 'revised',
        note: revisionNote.trim().slice(0, 1500) || `Updated copy to v${nextVersion}.`,
        actorName: sessionUser.displayName,
        actorRole: effectiveRole,
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          assetsByClient: {
            ...prev.assetsByClient,
            [activeClient.id]: (prev.assetsByClient[activeClient.id] || []).map((a) =>
              a.id === assetId
                ? { ...a, ...patch, version: nextVersion, status: nextStatus, updatedAt: nowIso }
                : a
            ),
          },
          revisionsByClient: {
            ...prev.revisionsByClient,
            [activeClient.id]: [revRecord, ...(prev.revisionsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Published revision v${nextVersion}.`);
        return;
      }

      try {
        await updateDoc(
          doc(db, `clients/${activeClient.id}/assets`, assetId),
          stripUndefined({
            ...patch,
            version: nextVersion,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          })
        );
        await setDoc(doc(db, `clients/${activeClient.id}/revisions`, revId), {
          clientId: revRecord.clientId,
          assetId: revRecord.assetId,
          version: revRecord.version,
          action: revRecord.action,
          note: revRecord.note,
          actorName: revRecord.actorName,
          actorRole: revRecord.actorRole,
          authorUid: revRecord.authorUid,
          memberUids: revRecord.memberUids,
          createdAt: serverTimestamp(),
        });
        notify('success', `Saved revision v${nextVersion}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${activeClient.id}/assets/${assetId}`);
      }
    },
    [activeClient, sessionUser, assets, effectiveRole, isDemoMode, notify]
  );

  const transitionAssetStatus = useCallback(
    async (
      assetId: string,
      nextStatus: AssetStatus,
      note: string,
      handoffPatch?: { brightBeanStatus?: BrightBeanStatus; brightBeanReference?: string }
    ) => {
      if (!activeClient || !sessionUser) return;
      const existingAsset = assets.find((a) => a.id === assetId);
      if (!existingAsset) return;

      if (!canTransitionAssetStatus(effectiveRole, existingAsset.status, nextStatus)) {
        notify('error', `Role "${effectiveRole}" cannot move an asset from ${existingAsset.status} to ${nextStatus}.`);
        return;
      }

      const revId = makeSafeId('rev');
      const nowIso = new Date().toISOString();
      const actionMap: Record<AssetStatus, AssetRevision['action']> = {
        draft: 'revised',
        in_review: 'submitted',
        revision_requested: 'revision_requested',
        approved: 'approved',
        handed_off: 'handed_off',
      };

      const revRecord: AssetRevision = {
        id: revId,
        clientId: activeClient.id,
        assetId,
        version: existingAsset.version,
        action: actionMap[nextStatus],
        note: note.trim().slice(0, 1500) || `Status changed to ${nextStatus.replace('_', ' ')}.`,
        actorName: sessionUser.displayName,
        actorRole: effectiveRole,
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          assetsByClient: {
            ...prev.assetsByClient,
            [activeClient.id]: (prev.assetsByClient[activeClient.id] || []).map((a) =>
              a.id === assetId
                ? {
                    ...a,
                    status: nextStatus,
                    reviewerNote: note.trim() || a.reviewerNote,
                    brightBeanStatus: handoffPatch?.brightBeanStatus || a.brightBeanStatus,
                    brightBeanReference: handoffPatch?.brightBeanReference || a.brightBeanReference,
                    updatedAt: nowIso,
                  }
                : a
            ),
          },
          revisionsByClient: {
            ...prev.revisionsByClient,
            [activeClient.id]: [revRecord, ...(prev.revisionsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Asset moved to "${nextStatus.replace('_', ' ')}".`);
        return;
      }

      try {
        const updatePayload: Record<string, unknown> =
          effectiveRole === 'client_reviewer'
            ? {
                status: nextStatus,
                reviewerNote: note.trim().slice(0, 1500),
                updatedAt: serverTimestamp(),
              }
            : stripUndefined({
                status: nextStatus,
                reviewerNote: note.trim().slice(0, 1500),
                brightBeanStatus: handoffPatch?.brightBeanStatus,
                brightBeanReference: handoffPatch?.brightBeanReference?.slice(0, 200),
                updatedAt: serverTimestamp(),
              });

        await updateDoc(doc(db, `clients/${activeClient.id}/assets`, assetId), updatePayload);
        await setDoc(doc(db, `clients/${activeClient.id}/revisions`, revId), {
          clientId: revRecord.clientId,
          assetId: revRecord.assetId,
          version: revRecord.version,
          action: revRecord.action,
          note: revRecord.note,
          actorName: revRecord.actorName,
          actorRole: revRecord.actorRole,
          authorUid: revRecord.authorUid,
          memberUids: revRecord.memberUids,
          createdAt: serverTimestamp(),
        });
        notify('success', `Asset updated to "${nextStatus.replace('_', ' ')}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${activeClient.id}/assets/${assetId}`);
      }
    },
    [activeClient, sessionUser, assets, effectiveRole, isDemoMode, notify]
  );

  const saveCompetitorReport = useCallback(
    async (
      report: Omit<CompetitorReport, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'>
    ) => {
      if (!activeClient || !sessionUser) return;
      const reportId = makeSafeId('comp');
      const nowIso = new Date().toISOString();
      const record: CompetitorReport = {
        ...report,
        id: reportId,
        clientId: activeClient.id,
        competitorName: report.competitorName.slice(0, 120),
        sourceUrl: report.sourceUrl?.slice(0, 400),
        summary: report.summary.slice(0, 2000),
        hookPatterns: report.hookPatterns.slice(0, 15),
        contentGaps: report.contentGaps.slice(0, 15),
        counterAngles: report.counterAngles.slice(0, 15),
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          competitorsByClient: {
            ...prev.competitorsByClient,
            [activeClient.id]: [record, ...(prev.competitorsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Saved competitor teardown for "${record.competitorName}".`);
        return;
      }

      try {
        await setDoc(
          doc(db, `clients/${activeClient.id}/competitors`, reportId),
          stripUndefined({
            clientId: record.clientId,
            competitorName: record.competitorName,
            sourceUrl: record.sourceUrl,
            summary: record.summary,
            hookPatterns: record.hookPatterns,
            contentGaps: record.contentGaps,
            counterAngles: record.counterAngles,
            authorUid: record.authorUid,
            memberUids: record.memberUids,
            createdAt: serverTimestamp(),
          })
        );
        notify('success', `Saved competitor report for "${record.competitorName}".`);
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `clients/${activeClient.id}/competitors/${reportId}`
        );
      }
    },
    [activeClient, sessionUser, isDemoMode, notify]
  );

  const addPerformanceMetrics = useCallback(
    async (
      rows: Array<Omit<PerformanceMetric, 'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'>>
    ) => {
      if (!activeClient || !sessionUser || rows.length === 0) return;
      const nowIso = new Date().toISOString();
      const created: PerformanceMetric[] = rows.map((row) => ({
        ...row,
        id: makeSafeId('met'),
        clientId: activeClient.id,
        postTitle: row.postTitle.slice(0, 160),
        publishedDate: row.publishedDate.slice(0, 30),
        pillar: (row.pillar || 'General').slice(0, 100),
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      }));

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          metricsByClient: {
            ...prev.metricsByClient,
            [activeClient.id]: [...created, ...(prev.metricsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', `Added ${created.length} performance snapshot${created.length > 1 ? 's' : ''}.`);
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const rec of created) {
          batch.set(
            doc(db, `clients/${activeClient.id}/metrics`, rec.id),
            stripUndefined({
              clientId: rec.clientId,
              postTitle: rec.postTitle,
              publishedDate: rec.publishedDate,
              format: rec.format,
              language: rec.language,
              pillar: rec.pillar,
              reach: rec.reach,
              likes: rec.likes,
              comments: rec.comments,
              saves: rec.saves,
              shares: rec.shares,
              avgWatchSec: rec.avgWatchSec,
              authorUid: rec.authorUid,
              memberUids: rec.memberUids,
              createdAt: serverTimestamp(),
            })
          );
        }
        await batch.commit();
        notify('success', `Imported ${created.length} performance row${created.length > 1 ? 's' : ''}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `clients/${activeClient.id}/metrics`);
      }
    },
    [activeClient, sessionUser, isDemoMode, notify]
  );

  const savePerformanceInsight = useCallback(
    async (
      insight: Omit<
        PerformanceRecommendation,
        'id' | 'clientId' | 'authorUid' | 'memberUids' | 'createdAt'
      >
    ) => {
      if (!activeClient || !sessionUser) return;
      const insightId = makeSafeId('ins');
      const nowIso = new Date().toISOString();
      const record: PerformanceRecommendation = {
        ...insight,
        id: insightId,
        clientId: activeClient.id,
        headline: insight.headline.slice(0, 180),
        executiveSummary: insight.executiveSummary.slice(0, 2000),
        doubleDown: insight.doubleDown.slice(0, 12),
        adjustments: insight.adjustments.slice(0, 12),
        nextMonthExperiment: insight.nextMonthExperiment.slice(0, 800),
        authorUid: sessionUser.uid,
        memberUids: activeClient.memberUids,
        createdAt: nowIso,
      };

      if (isDemoMode) {
        setDemoStore((prev) => ({
          ...prev,
          insightsByClient: {
            ...prev.insightsByClient,
            [activeClient.id]: [record, ...(prev.insightsByClient[activeClient.id] || [])],
          },
        }));
        notify('success', 'Saved Gemini performance recommendations.');
        return;
      }

      try {
        await setDoc(doc(db, `clients/${activeClient.id}/insights`, insightId), {
          clientId: record.clientId,
          headline: record.headline,
          executiveSummary: record.executiveSummary,
          doubleDown: record.doubleDown,
          adjustments: record.adjustments,
          nextMonthExperiment: record.nextMonthExperiment,
          authorUid: record.authorUid,
          memberUids: record.memberUids,
          createdAt: serverTimestamp(),
        });
        notify('success', 'Saved Gemini performance recommendations to Firestore.');
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `clients/${activeClient.id}/insights/${insightId}`
        );
      }
    },
    [activeClient, sessionUser, isDemoMode, notify]
  );

  const launchFromCalendarSlot = useCallback(
    (target: 'captions' | 'reels', topic: string, pillar: string) => {
      setDraftSeedTopic(topic);
      setDraftSeedPillar(pillar);
      setActiveView(target);
    },
    []
  );

  const clearDraftSeed = useCallback(() => {
    setDraftSeedTopic('');
    setDraftSeedPillar('');
  }, []);

  const value: StudioContextValue = {
    authReady,
    sessionUser,
    isDemoMode,
    activeView,
    setActiveView,
    clients,
    activeClientId,
    activeClient,
    setActiveClientId,
    effectiveRole,
    permissions,
    demoRoleOverride,
    setDemoRoleOverride,
    memoryItems,
    calendars,
    assets,
    revisions,
    competitors,
    metrics,
    insights,
    brandContext,
    loadingClientData,
    draftSeedTopic,
    draftSeedPillar,
    launchFromCalendarSlot,
    clearDraftSeed,
    loginWithGoogle,
    enterDemoWorkspace,
    logout,
    seedStarterWorkspaces,
    createClientWorkspace,
    updateClientWorkspace,
    addClientMember,
    removeClientMember,
    addMemoryItem,
    deleteMemoryItem,
    saveMonthlyCalendar,
    saveContentAsset,
    updateAssetContent,
    transitionAssetStatus,
    saveCompetitorReport,
    addPerformanceMetrics,
    savePerformanceInsight,
    toast,
    notify,
    dismissToast: () => setToast(null),
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
