import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExternalHttpUrl } from './urlSafety';
import {
  buildBrightBeanCsv,
  buildBrightBeanPayload,
  canTransitionAssetStatus,
  getRolePermissions,
  parsePerformanceCsv,
} from './workflow';
import {
  calculateEngagementRate,
  calculateSaveRate,
  summarizePerformance,
} from './analytics';
import { buildSevenDayCoverage, formatMetaCopyPack } from './dailyPlanner';
import type {
  ClientWorkspace,
  ContentAsset,
  DailyAutopilotResult,
  PerformanceMetric,
} from '../types/studio';

test('validateExternalHttpUrl accepts public https URLs and blocks private/internal targets', () => {
  assert.equal(validateExternalHttpUrl('https://brightbean.studio/hooks/client-1').valid, true);
  assert.equal(validateExternalHttpUrl('http://localhost:3000/api').valid, false);
  assert.equal(validateExternalHttpUrl('http://127.0.0.1:8080/internal').valid, false);
  assert.equal(validateExternalHttpUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateExternalHttpUrl('http://192.168.1.10/admin').valid, false);
  assert.equal(validateExternalHttpUrl('http://10.0.0.5/secret').valid, false);
  assert.equal(validateExternalHttpUrl('javascript:alert(1)').valid, false);
  assert.equal(validateExternalHttpUrl('https://user:pass@example.com/hook').valid, false);
});

test('role permissions enforce multi-client agency RBAC boundaries', () => {
  const admin = getRolePermissions('admin');
  const strategist = getRolePermissions('strategist');
  const reviewer = getRolePermissions('client_reviewer');

  assert.equal(admin.canManageMembers, true);
  assert.equal(strategist.canCreateContent, true);
  assert.equal(strategist.canManageClient, false);
  assert.equal(reviewer.canReviewAsset, true);
  assert.equal(reviewer.canCreateContent, false);
  assert.equal(reviewer.canDispatchHandoff, false);
});

test('asset status transitions prevent client reviewers from shortcutting or editing terminal states', () => {
  assert.equal(canTransitionAssetStatus('client_reviewer', 'in_review', 'approved'), true);
  assert.equal(canTransitionAssetStatus('client_reviewer', 'in_review', 'revision_requested'), true);
  assert.equal(canTransitionAssetStatus('client_reviewer', 'draft', 'approved'), false);
  assert.equal(canTransitionAssetStatus('client_reviewer', 'approved', 'handed_off'), false);
  assert.equal(canTransitionAssetStatus('strategist', 'draft', 'in_review'), true);
  assert.equal(canTransitionAssetStatus('strategist', 'approved', 'handed_off'), true);
  assert.equal(canTransitionAssetStatus('strategist', 'handed_off', 'draft'), false);
});

test('BrightBean JSON and CSV serializers format multilingual captions and escape commas/quotes', () => {
  const client: ClientWorkspace = {
    id: 'client-1',
    name: 'Aaranya Looms',
    monogram: 'AL',
    industry: 'Artisanal Textiles',
    website: 'https://aaranyalooms.in',
    primaryMarkets: 'Ahmedabad, Mumbai',
    brandSummary: 'Handloom studio',
    bannedTerms: 'cheap',
    defaultLanguages: ['en', 'hi', 'gu'],
    brightBeanWorkspaceId: 'bb-aaranya-01',
    brightBeanWebhookUrl: '',
    ownerUid: 'u1',
    memberUids: ['u1'],
    memberRoles: { u1: 'admin' },
    memberDirectory: [],
  };

  const asset: ContentAsset = {
    id: 'asset-1',
    clientId: 'client-1',
    title: 'Patola Heritage, "Winter Edit"',
    assetType: 'caption_pack',
    platform: 'Instagram',
    pillar: 'Craft Stories',
    status: 'approved',
    version: 2,
    languages: ['en', 'hi', 'gu'],
    captions: {
      en: 'Woven across 45 days in Patan.',
      hi: 'पाटन के कारीगरों की 45 दिनों की मेहनत।',
      gu: 'પાટણના કારીગરોની 45 દિવસની કળા.',
    },
    hashtags: ['#PatolaSilk', '#HandloomIndia'],
    cta: 'Save for festive gifting',
    brightBeanStatus: 'pending',
    authorUid: 'u1',
    memberUids: ['u1'],
  };

  const payload = buildBrightBeanPayload(client, asset, '2026-11-24T12:00:00.000Z');
  assert.equal(payload.brightBeanWorkspaceId, 'bb-aaranya-01');
  assert.equal(payload.asset.captions.gu, 'પાટણના કારીગરોની 45 દિવસની કળા.');

  const csv = buildBrightBeanCsv(client, [asset]);
  assert.ok(csv.includes('"Patola Heritage, ""Winter Edit"""'));
  assert.ok(csv.includes('પાટણના કારીગરોની 45 દિવસની કળા.'));
});

test('parsePerformanceCsv parses valid rows and catches invalid inputs', () => {
  const sample = [
    'post_title,published_date,format,language,pillar,reach,likes,comments,saves,shares,avg_watch_sec',
    '"Patan Patola Reel",2026-11-12,Reel,Gujarati,Craft Stories,24000,1450,92,680,210,19.4',
    ',2026-11-13,Carousel,English,Style Guide,5000,100,10,50,12,',
  ].join('\n');

  const parsed = parsePerformanceCsv(sample);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.rows[0].postTitle, 'Patan Patola Reel');
  assert.equal(parsed.rows[0].saves, 680);
});

test('analytics summary computes accurate engagement rates and top performers', () => {
  const metrics: PerformanceMetric[] = [
    {
      id: 'm1',
      clientId: 'c1',
      postTitle: 'Gujarati Reel',
      publishedDate: '2026-11-10',
      format: 'Reel',
      language: 'Gujarati',
      pillar: 'Craft',
      reach: 10000,
      likes: 600,
      comments: 50,
      saves: 250,
      shares: 100,
      authorUid: 'u1',
      memberUids: ['u1'],
    },
    {
      id: 'm2',
      clientId: 'c1',
      postTitle: 'English Static',
      publishedDate: '2026-11-11',
      format: 'Static',
      language: 'English',
      pillar: 'Product',
      reach: 10000,
      likes: 200,
      comments: 20,
      saves: 40,
      shares: 10,
      authorUid: 'u1',
      memberUids: ['u1'],
    },
  ];

  assert.equal(calculateEngagementRate(metrics[0]), 10);
  assert.equal(calculateSaveRate(metrics[0]), 2.5);
  const summary = summarizePerformance(metrics);
  assert.equal(summary.totalReach, 20000);
  assert.equal(summary.topFormat, 'Reel');
  assert.equal(summary.topLanguage, 'Gujarati');
  assert.equal(summary.avgEngagementRate, 6.35);
});

test('buildSevenDayCoverage tracks daily 1-post-per-day streak and today coverage', () => {
  const baseAsset = {
    clientId: 'c1',
    assetType: 'reel_script' as const,
    platform: 'Instagram Reels',
    pillar: 'Craft',
    status: 'draft' as const,
    version: 1,
    languages: ['en'],
    brightBeanStatus: 'pending' as const,
    authorUid: 'u1',
    memberUids: ['u1'],
  };

  const assets: ContentAsset[] = [
    { ...baseAsset, id: 'a1', title: 'Day 1', createdAt: '2026-11-22T09:00:00Z' },
    { ...baseAsset, id: 'a2', title: 'Day 2', createdAt: '2026-11-23T10:00:00Z' },
    { ...baseAsset, id: 'a3', title: 'Today Reel', createdAt: '2026-11-24T11:00:00Z' },
  ];

  const coverage = buildSevenDayCoverage(assets, '2026-11-24');
  assert.equal(coverage.days.length, 7);
  assert.equal(coverage.todayCovered, true);
  assert.equal(coverage.coveredDays, 3);
  assert.equal(coverage.streakDays, 3);
  assert.equal(coverage.days[6].latestTitle, 'Today Reel');
});

test('formatMetaCopyPack produces a clean ready-to-paste Instagram Reel pack', () => {
  const pack: DailyAutopilotResult = {
    dateLabel: '2026-11-24',
    chosenFormat: 'Reel',
    whyToday: 'Trending search spike around winter wedding heirloom silk care.',
    researchHighlights: ['Winter wedding inquiries peaked this week.'],
    sources: [{ title: 'Trend Source', url: 'https://example.com/trend' }],
    title: 'How to Spot Handwoven Patola in 3 Seconds',
    pillar: 'Craft Provenance',
    bestPostingTime: '7:30 PM IST',
    captions: {
      en: 'Look closely at the selvedge before buying.',
      gu: 'ખરીદી પહેલા કિનારી ધ્યાનથી જુઓ.',
    },
    hashtags: ['#PatanPatola', '#Handloom'],
    cta: 'Save for bridal shopping',
    visualBrief: 'Warm courtyard sunlight macro shots.',
    reelHooks: [
      {
        angle: 'Curiosity',
        spokenHook: 'Stop buying fake silk.',
        visualCue: 'Macro zoom on silk border.',
        language: 'en',
      },
    ],
    reelScenes: [
      {
        timecode: '00:00-00:03',
        visualDirection: 'Macro loom shot',
        onScreenText: 'Real vs Fake Silk',
        voiceover: 'Stop buying fake silk.',
        audioCue: 'Loom ASMR',
      },
    ],
  };

  const text = formatMetaCopyPack(pack, 'Aaranya Looms');
  assert.ok(text.includes('Aaranya Looms — Daily Instagram Reel (2026-11-24)'));
  assert.ok(text.includes('[GUJARATI CAPTION]'));
  assert.ok(text.includes('[REEL SCRIPT]'));
  assert.ok(text.includes('#PatanPatola #Handloom'));
});

test('buildAdaptiveCalendarSlots maps day offsets cleanly across month boundaries', async () => {
  const { buildAdaptiveCalendarSlots } = await import('./dailyPlanner');
  const slots = buildAdaptiveCalendarSlots(
    [
      {
        dayOffset: 0,
        format: 'Reel',
        pillar: 'Craft',
        topic: 'Day 1 Loom Hook',
        hookIdea: 'Close-up loom sound',
        languages: ['en', 'gu'],
        ctaGoal: 'Save post',
      },
      {
        dayOffset: 2,
        format: 'Carousel',
        pillar: 'Care',
        topic: 'Silk Storage Guide',
        hookIdea: 'Stop using plastic bags',
        languages: ['en', 'hi'],
        ctaGoal: 'Bookmark',
      },
    ],
    '2026-11-30'
  );

  assert.equal(slots.length, 2);
  assert.equal(slots[0].dateLabel, 'Nov 30');
  assert.equal(slots[0].dayOfMonth, 30);
  assert.equal(slots[1].dateLabel, 'Dec 02');
  assert.equal(slots[1].dayOfMonth, 2);
});
