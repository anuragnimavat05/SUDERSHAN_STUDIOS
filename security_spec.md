# Sudershan AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: All unmatched paths return `PERMISSION_DENIED`.
2. **Verified Identity**: All writes require authenticated users with `request.auth.token.email_verified == true`.
3. **PII Isolation**: `/users/{userId}` can only be read by `request.auth.uid == userId` or the verified bootstrap admin (`nimavatanurag47@gmail.com`). Users cannot self-assign `agencyRole: "admin"`.
4. **Multi-Client Isolation (Master Gate)**: Every subcollection under `/clients/{clientId}/*` verifies parent client existence and active membership on `get`, `create`, `update`, and `delete`, and enforces `request.auth.uid in resource.data.memberUids` on `list` queries without `get()` lookups.
5. **Role Boundaries**:
   - `admin` (Workspace Owner or verified bootstrap admin): Full client management, member management, asset lifecycle, and BrightBean handoff configuration.
   - `strategist`: Create/edit Brand Memory, Calendars, Competitor Reports, Performance Metrics, Insights, and Content Assets (`draft`, `in_review`, `handed_off` from `approved`), and append revision logs. Cannot alter client membership or BrightBean webhook URLs.
   - `client_reviewer`: Read assigned client workspace, submit revision feedback, and transition assets strictly between `in_review` -> `revision_requested` or `approved` (affected keys restricted to `['status', 'reviewerNote', 'updatedAt']`).
6. **Terminal State & Immutability**: `createdAt`, `authorUid`, `clientId`, and `ownerUid` are immutable after creation; `revisions` are append-only (no update/delete by non-admins); assets in `handed_off` state cannot be mutated by non-admins.
7. **Volumetric & Timestamp Integrity**: Every string has `.size()` bounds; every array has `.size()` bounds; `createdAt == request.time` on create and `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /clients/client_1` with `auth == null`.
2. **Cross-Client Read Leak**: User B (not in `client_1.memberUids`) attempts `GET /clients/client_1/assets/asset_1`.
3. **Self-Privilege Escalation**: Regular user writes `/users/{uid}` with `agencyRole: "admin"`.
4. **Email Spoofing**: Token has `email: "nimavatanurag47@gmail.com"` but `email_verified: false`.
5. **Shadow Field Injection**: Strategist creates `/clients/client_1/memory/mem_1` with extra ghost field `isSystemVerified: true`.
6. **Author UID Spoofing**: Strategist creates `/clients/client_1/assets/asset_2` with `authorUid: "someone_else_uid"`.
7. **Client Reviewer Editing Brand Config**: Reviewer attempts `UPDATE /clients/client_1` modifying `brightBeanWebhookUrl`.
8. **Client Reviewer Modifying Captions**: Reviewer attempts `UPDATE /clients/client_1/assets/asset_1` modifying `captions` instead of only `['status', 'reviewerNote', 'updatedAt']`.
9. **State Shortcutting**: Reviewer attempts to transition `draft` directly to `handed_off`.
10. **Terminal State Mutation**: Strategist modifies an asset whose existing `status == "handed_off"`.
11. **ID Poisoning**: Creating `/clients/client_1/memory/../../invalid$id` or 200-char ID.
12. **Client Timestamp Forgery**: Creating `/clients/client_1/memory/mem_2` with client-supplied past timestamp instead of `request.time`.
