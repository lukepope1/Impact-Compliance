# Phased build plan

Derived from the developer handoff (blueprint, backlog, schema, wireframes) and the README's
own sprint plan. Each phase was built to work end-to-end before the next started —
versioning and immutability are painful to retrofit, so the foundation got the most care.

All six phases are now built and verified live (in-browser, against the local embedded
Postgres, not just typechecked). See docs/LOCAL_DEV.md to run it.

## Phase 0 — Foundation ✅
- Repo scaffold: server (Express + TS + Prisma/Postgres), client (React + TS + Vite)
- Full canonical data model as Prisma schema, 1:1 with `NMTC_Phase_1_Database_Schema.sql`
- Auth scaffold: session/user model, org-scoped membership, role checking middleware
- Seed script with one sample deal (Millennium Holdings, matching the wireframes)

## Phase 1 — Tenancy, deal configuration, requirement definitions ✅
- Organizations, users, memberships, deal CRUD, deal party/CDE participation setup
- Requirement definition builder (versioned, with source-clause lineage + conflict flagging)
- Impact Marketplace admin screens: deal setup wizard (I-02), requirement builder (I-03)

## Phase 2 — Evidence & audit ✅
- Document upload with version lineage, checksum, malware-scan status (local disk in dev,
  real S3+KMS available — see the Evidence storage section below)
- Document access grants (share-scope enforcement server-side, not client-filtered)
- Audit event log wired into every mutation

## Phase 3 — Deadline engine & requirement instances ✅
- Requirement instance generator from due_rule JSON (days-after-period-end / fixed dates /
  one-time / on-request), calendar-aligned periods
- Overdue/upcoming status recomputed live

## Phase 4 — QALICB portal ✅
- Dashboard, requirement detail & upload, submission review & attestation
- Submissions immutable once submitted (enforced in the submission route, mirroring the
  SQL schema's protect_final_submission trigger)

## Phase 5 — Review & CDE portal ✅
- Impact review queue, return/resubmit workflow (return requires a note)
- CDE portfolio dashboard, review queue, requirement review, documents, issues

## Phase 6 — CBR, AMIS, Multi-CDE ✅
- Community Benefits Report builder (project profile, jobs, tenants)
- Multi-CDE shared outcome snapshots + per-CDE approval — locks only once every
  participating CDE has decided
- AMIS field readiness + CSV export generation, blocked while fields are missing, every
  output value traced to its source (manual filing only — no auto-submission to AMIS)
- **Field catalog expanded from 3 to 13 real fields** (`lib/goldenFields.ts`): revenue,
  NOI, jobs created/retained/construction, tenant count (CBR-sourced, year-scoped);
  closing date, QEI total, QLICI principal total, lead CDE allocation control number,
  project census tract/city/state (deal/CDE/QLICI/address-sourced, year-independent).
  Verified live against the seeded deal — real computed values for populated fields
  (jobs retained: 18, construction: 1), correctly `"missing"` for genuinely unpopulated
  ones (QEI, QLICI, project address weren't seeded), proving the readiness-gating logic
  holds at this larger field count. Caught and fixed a real bug along the way: adding a
  `date` dataType exposed that `snapshots.ts`'s field-value storage only handled
  `text` vs. everything-else-is-numeric, which would have silently mis-stored a date
  string as `valueNumber`.

## Auth ✅ (real, not a stub)
- Bcrypt-hashed passwords, JWT-signed sessions (`POST /api/auth/login`), verified on every
  request via the Authorization header — replacing the earlier `x-user-email` dev stub
- Login page + role-gated portal guards (a QALICB user can't open `/impact`, etc.),
  verified live across all three seeded demo accounts including the redirect-after-login path
- Still an interim local-credential system standing in for a real identity provider (AWS
  Cognito or equivalent, per the schema's original implementation notes) — see the swap-out
  point noted in `server/src/lib/authTokens.ts`. Swapping it means changing `requireAuth`
  to verify the IdP's tokens instead of these; the shape of everything downstream (load
  user, attach memberships) doesn't change.

## Evidence storage: real S3 + KMS (built, not yet run against live AWS)
- `s3Storage.ts` implements the same Storage interface as local disk — switching backends
  is an env var (`EVIDENCE_S3_BUCKET`), not a code change
- SSE-KMS on every upload (never SSE-S3), a boot-time reachability check so a bad
  bucket/region/IAM config fails loudly at startup instead of on a user's first upload
- `infra/evidence-bucket.yaml`: CloudFormation for the bucket (public access blocked,
  versioning on, default SSE-KMS) + a dedicated KMS CMK + a bucket policy that denies
  non-KMS uploads and non-TLS requests + a least-privilege IAM policy scoped to exactly
  what the app calls
- Built in an environment with no AWS credentials available, so this has been reviewed for
  correctness against the documented SDK/AWS behavior but **not exercised against a live
  bucket** — see docs/AWS_SETUP.md for what to check before trusting it with real evidence

## Malware scanning: real ClamAV pipeline
- `scanner.ts` implements clamd's `INSTREAM` protocol directly (no third-party package) —
  every upload is scanned before its database row is even created
- Fail-closed: with no scanner configured, uploads stay `"pending"` (undownloadable), never
  silently `"clean"` — this replaces a hardcoded `"clean"` that shipped with Phase 2 before
  this pipeline existed
- An infected result creates a critical `security` Issue on the deal, not just a quietly
  blocked download; a `/rescan` endpoint recovers versions stuck at `pending`/`failed`
  without touching an already-settled `clean`/`infected` result
- See docs/MALWARE_SCANNING.md for local setup and production deployment shapes (sidecar
  container, systemd service, or an async Lambda-based pattern for serverless)
- The fail-closed behavior and rescan guard were verified live; the clamd protocol client
  itself was not — a local ClamAV install was attempted but got stuck behind a Windows UAC
  prompt this environment couldn't answer. Same "reviewed, not proven live" honesty as the
  S3+KMS integration — see docs/MALWARE_SCANNING.md's verification-status note.

## Document versioning UI ✅
- The Documents page now has an expandable "Version history" panel per document (full
  history, not just the latest), an "Upload new version" form wired to the previously-
  unused `uploadNewVersion` API, and a Rescan button on pending/failed versions
- Verified live: uploaded a second version of an existing document, confirmed v1 was
  marked superseded but stayed downloadable, v2 landed "pending" with a Rescan button

## Notifications: real trigger-based pipeline ✅
- In-app + email notifications on submission-submitted, returned, impact-approved, and
  due-soon/overdue transitions — see docs/NOTIFICATIONS.md for the full trigger table
- Fail-visible email: no SMTP configured -> the email row is recorded `"failed"` with a
  clear reason, never silently dropped; the in-app notification always gets created either way
- **Deadline reminders now run on a real scheduled sweep** (`lib/deadlineSweep.ts`,
  wired up in `index.ts` via `setInterval`, default hourly), not just page-load-triggered
  — a reminder fires on wall-clock time even if nobody opens the app that day. Verified
  live by running the sweep directly against the real database outside the request cycle.
  **Coordinated across multiple instances too**, via a Postgres transaction-scoped
  advisory lock (`pg_try_advisory_xact_lock`) — every instance shares the same database,
  so whichever instance's tick acquires the lock sweeps, every other concurrent tick
  skips cleanly rather than racing into duplicate reminders. Verified live: two
  transactions run concurrently against the real database, the second correctly blocked
  for the whole window the first held the lock open. See docs/NOTIFICATIONS.md.
- Verified live end to end: returned a submission as Impact, confirmed the QALICB
  submitter got an in-app notification (visible in the bell, mark-as-read worked) and a
  corresponding email row recorded as "failed" (SMTP unconfigured, as expected)
- **Real SMTP delivery now verified too**: pointed SMTP at a free Ethereal test account
  (no pre-existing credentials needed), submitted a requirement, confirmed the resulting
  email notification came back `status: "sent"` with a real provider message ID, and
  visually confirmed the actual rendered email at Ethereal's preview URL. Proves the send
  path genuinely works — production-provider deliverability (SES/SendGrid + real DNS/SPF/
  DKIM) is still unverified, see docs/NOTIFICATIONS.md.
- **Per-user notification preferences** (`lib/notificationPreferences.ts`, a new
  `NotificationPreference` table, `/notifications/preferences` screen linked from the
  bell): opt-out per event × channel, defaulting to enabled so nobody's notifications
  change unless they visit the settings page. `notify()` checks the preference before
  creating each channel's row — a disabled channel gets no row at all. Verified live: a
  real submit-then-return cycle with email disabled for that event produced only an
  `in_app` row (confirmed directly against the database, since the earlier event before
  the preference existed still had both rows); the settings page itself round-tripped a
  live toggle through a page reload.
- **Email digest / batching** (`lib/notificationDigest.ts`, a new
  `UserNotificationSettings` table, a second scheduled sweep in `index.ts` next to the
  deadline sweep): each user can choose immediate email (default) or a daily digest — one
  consolidated message instead of one per event. In digest mode, `notify()` still records
  the email row but leaves it `"queued"` instead of sending; `runDigestSweep()` finds
  every daily-mode user's queued rows, sends one email, and flips them all to `"sent"`/
  `"failed"` together. Coordinated across instances the same way as the deadline sweep
  (its own Postgres advisory-lock key). In-app notifications are never digested — only
  email batches, since delaying the bell itself would defeat the point of checking it.
  Verified live end to end with real Ethereal SMTP: set a user to daily mode, ran a real
  submit-then-return cycle, confirmed the email row sat at `"queued"` immediately after,
  then ran the sweep directly and confirmed one real email sent with a real provider
  message ID and the row flipped to `"sent"` — while an older, unrelated `"failed"` row
  was correctly left untouched (the sweep only acts on `"queued"` rows).

## Security review ✅ (findings fixed and verified live)
Three parallel audits (auth/access-control, deal-scoped/document routes, dependencies/infra)
found and I fixed:
- **Cross-org review forgery (HIGH)**: `reviews.ts` picked a reviewing org from *any* of
  the user's memberships holding a reviewer role, without confirming that specific org
  is actually party to the deal — a user with a reviewer role at an unrelated CDE plus
  any other membership giving deal access could record binding approve/return/waive
  decisions. Fixed: the org is now confirmed to have `dealOrganizationAccess` (impact
  stage) or `cdeParticipation` (cde stage) on this exact deal before it's trusted, same
  pattern `snapshots.ts` already used correctly.
- **AMIS export cross-CDE leak (MEDIUM)**: any `cde_admin` could generate/download AMIS
  financial exports for a deal their CDE has no participation in. Fixed with the same
  participation check.
- **No login rate limiting (HIGH, confirmed by two independent audits)**: `/api/auth/login`
  had no throttling — fixed with `express-rate-limit` (10 attempts / 15 min, IP-keyed).
  Verified live: 4th rapid attempt returns 429 with `RateLimit-*` headers.
- **JWT algorithm not pinned (MEDIUM)**: `jwt.verify` trusted whatever `alg` a token
  claimed. Fixed by requiring `algorithms: ["HS256"]` explicitly on verify (and signing
  with it explicitly too).
- **Weak-secret guard only enforced in production (HIGH contingent)**: the JWT_SECRET
  strength check only ran when `NODE_ENV=production`, so a misconfigured non-prod
  deployment got no protection. Fixed to enforce unconditionally — the local dev secret
  was regenerated to a real random value since the old placeholder (containing "dev")
  now correctly fails the check.
- **Missing security headers (LOW/MEDIUM)**: added `helmet()` — verified live
  (`X-Content-Type-Options`, `X-Frame-Options` present on responses).
- **Cross-tenant organization directory (MEDIUM)**: `GET /api/organizations` returned
  every organization on the platform to any authenticated user, including a QALICB or
  CDE user with no relationship to most of them. Restricted to the Impact roles that
  actually use it for deal-setup pickers. Verified live: 200 for an Impact user, 403 for
  a QALICB user.
- **Unvalidated `organizationId` on deal parties (LOW)**: `dealParties.ts` accepted any
  string as `organizationId` with no existence check. Fixed with a lookup before create.

Reviewed and found solid (no changes needed): generic login error messages, `documents.ts`/
`comments.ts`/`notificationsRouter.ts` user/org scoping, `canAccessDocument` re-derivation,
`sanitizeFileName`, S3 SSE-KMS enforcement, scanner fail-closed behavior, CORS origin
scoping, no raw SQL/`exec`, no hardcoded secrets, `.env` never committed to git history,
`.env.example` contains only placeholders, dependency versions current.

**Structural fix, built and rolled out**: `requireRoleOnDealOrg(...roles)` (in
`middleware/auth.ts`) replaces the `requireDealAccess` + `requireRole` pair everywhere a
deal-scoped write route needs both — it finds a membership holding one of the given
roles *and* confirms that specific organization has `DealOrganizationAccess` on this
exact deal, attaching the matched membership as `res.locals.dealOrgMembership` so the
handler doesn't have to re-derive it. Rolled out across every deal-scoped write route
that previously chained the two separately: `cbr.ts` (all 5), `submissions.ts` (all 3 —
also fixed `submittedByOrganizationId` to use the matched org instead of
`memberships[0]`), `documents.ts` (upload, new-version, rescan, access-grants),
`requirementDefinitions.ts` (create/publish/conflict), `requirementInstances.ts`
(generate/request), `snapshots.ts` (generate/approve — approve's inline check replaced
with the shared middleware), `amis.ts` (export), `reviews.ts` (via the exported
`findDealOrgMembership` helper, since its role set depends on `stage` from the request
body and can't be a static middleware), `dealParties.ts`, `cdeParticipations.ts`,
`auditEvents.ts`, and `deals.ts`'s update route. Verified live: a QALICB user's draft
submission still attributes to the correct org, read routes are unaffected, and a CDE
reviewer's cross-org impact-stage review attempt now correctly returns 403.

Read-only routes (`GET .../requirement-instances`, `GET .../cbr/:year`, etc.) still use
plain `requireDealAccess` — they don't write data tied to a specific org, so the extra
per-org check isn't needed there; deal list/create routes with no `dealId` in scope still
use plain `requireRole`.

## What's deliberately out of scope for this build
- No direct AMIS API integration or auto-certification
- No legal/recapture determination logic — issues are operational flags, not conclusions
- No sharing of CDE-private *evidence* (documents) across CDE organizations — correctly
  enforced via per-org access grants. Note: `comments.ts`'s `cde_private` visibility is
  looser than the name implies (shared across every CDE on a deal, not just the
  authoring one) — see the CDE-private issue notes entry below for the contrast and why
  it wasn't fixed here
- AMIS export covers a hardcoded 13-field set (goldenFields.ts) proving the mechanism at
  a realistic scale, not AMIS's full production field catalog

## UAT pass ✅ (live functional walkthrough)
Walked every portal's golden path against the running app — see docs/UAT_PASS.md for
the full account. Not a re-check against the original backlog/wireframe documents (chat
uploads, not accessible from this environment anymore) — a live interactive pass
instead, verified via a mix of browser interaction, direct API calls, and reading
responses/console/network. No bugs found; every recent fix (the security review's
`requireRoleOnDealOrg` middleware, the currency/number formatting pass, the deadline
sweep) held up under real interactive use, including a live cross-portal review-approval
flow and a live 403 against an under-privileged account. The login rate limiter fired
correctly under this session's own repeated test traffic, confirming it live rather than
just in isolation.

## Post-UAT feature additions ✅
Requested and built one at a time after the UAT pass, each typechecked, verified live,
and documented at the time:
- **Notification preferences & email digest** — see the Notifications section above
- **Document search/filtering** (`Documents.tsx`): client-side title/type/sharing-level
  filters over the already-access-controlled list. Verified live: a title search
  correctly narrowed 3 documents to 1 matching row.
- **Bulk-waive** (`Deadlines.tsx`): checkboxes on every waivable instance, a shared reason
  field, sequential calls to the existing single-instance review endpoint (each waive
  stays its own real write with its own audit event). Verified live: two real instances
  waived together, both flipped to `"waived"` in the refreshed list.
- **Audit Log CSV export** (`AuditLog.tsx`): client-side CSV generation from the
  already-fetched (server-capped at 200) events, RFC 4180-ish escaping, a UTF-8 BOM for
  Excel. Verified the escaping logic against edge cases (commas, embedded quotes,
  newlines) in Node; the actual file-save is inert in this session's sandboxed browser
  pane so that specific step wasn't directly observable here.
- **CDE-private notes on issues** (new `IssueNote` model + `/issues/:issueId/notes`
  routes + a notes panel on `Issues.tsx`): a note distinct from an issue's shared
  title/description, either `org_private` (visible only to the authoring org and Impact)
  or `deal_shared`. Built correctly scoped to the *specific* authoring organization —
  unlike `comments.ts`'s existing `cde_private` visibility, which is scoped by org *type*
  and so actually shares a "CDE-private" comment across every CDE on a multi-CDE deal,
  not just the authoring one (a real gap in that earlier feature, left as-is since fixing
  it wasn't what was asked — flagged here for visibility). Verified live end to end:
  Enterprise Financial CDE posted a private note and a shared one; Impact and Enterprise
  both saw both, QALICB saw only the shared one, and — checked directly against the same
  filter logic used at request time — HRV Sub-CDE 62 (a different CDE on the same deal)
  would see only the shared note too, confirming the org-scoping actually holds instead
  of leaking across CDEs the way the comment feature does.
- **Deal archival workflow** (`DealDetail.tsx` + `deals.ts`'s `PATCH` route): a status
  widget replacing the old plain "Status: X" text — a dropdown of only the *valid* next
  statuses for the deal's current one, a required reason (recorded in the audit log, not
  a persisted column) when moving to `closed` or `archived`. Server-enforced lifecycle:
  `onboarding → active → {exception, winding_down} → closed → archived`, with `archived`
  terminal (no un-archive path) and `closed`/`archived` excluded from the deadline sweep
  (see `deadlineSweep.ts`'s existing `notIn: ["closed", "archived"]` filter — this gives
  that filter an actual UI path to reach, instead of only being reachable by a raw PATCH).
  Verified live end to end: an invalid jump (`onboarding` straight to `closed`) correctly
  rejected with 409 and the allowed-next-statuses listed; a valid multi-step path through
  to `closed` without a reason correctly rejected with 400, then succeeded once a reason
  was supplied; confirmed via a direct query that the closed deal was then excluded from
  the sweep's target list; and the dropdown/button flow itself was exercised live in the
  browser (`active → exception → active`), correctly narrowing to just the valid next
  options at each step. Also surfaced, in passing, a real pre-existing gap unrelated to
  this feature: a deal created via `NewDeal.tsx` gets no `DealOrganizationAccess` row for
  its creating org, so nobody — including the Impact user who just created it — can open
  it afterward (404s indefinitely); noted here since it isn't what was asked and wasn't
  fixed, but is worth someone's attention.
- **Richer dashboards + more demo data**: the three portal dashboards (Impact's Deal
  Portfolio, the QALICB Dashboard, the CDE Portfolio) were bare — a single table with no
  summary. Added a shared `stat-grid`/`stat-card` pattern (index.css) and a shared
  `StatusBadge`/`dealStatusBadgeClass` component (`pages/shared/StatusBadge.tsx`) so
  every dashboard/table renders requirement-instance and deal statuses the same
  color-coded way instead of each screen inventing its own. Impact's Deal Portfolio and
  the CDE Portfolio each gained a KPI row (deal counts, portfolio-wide overdue/pending-
  review totals) computed from a per-deal requirement-instance fetch, plus colored
  overdue/upcoming badges in their tables.

  Also seeded two more QALICB orgs/deals (`prisma/additionalQalicbs.ts`, called from
  `seed.ts` for fresh installs and also run once against this session's live dev
  database): **Riverside Manufacturing LLC** (`RIVER-2025`, active, 5 overdue
  requirements) and **Harbor Health Clinic Inc** (`HARBOR-2026`, onboarding, 1 overdue),
  both participating with Enterprise Financial CDE alongside the original Millennium
  Holdings deal — so the CDE portfolio (and Impact's deal list) actually show multiple
  rows with different statuses instead of a single-deal demo. New login accounts:
  `mchen@riversidemfg.example` and `rpatel@harborhealth.example` (same shared dev
  password). Requirement instances were generated through the real
  `/requirement-instances/generate` API (not hand-inserted), and one Riverside
  requirement was submitted and Impact-approved for real so the CDE's "pending review"
  count isn't uniformly zero across every deal.

  Verified live, all three dashboards: Impact's Deal Portfolio shows all 3 deals with
  correct per-deal overdue/upcoming counts and status badges (Harbor 1 overdue,
  Riverside 5, Millennium 2 — 8 total, matching the stat card); the CDE Portfolio (signed
  in as `reviewer@enterprisecde.example`) shows the same 3 deals with matching per-deal
  overdue counts, 8 total, 2 deals with something pending CDE review; the QALICB
  Dashboard (signed in as the new `mchen@riversidemfg.example`) correctly shows only
  Riverside's own 28 requirement instances (5 overdue), with one already `Impact
  Approved` from the review-queue test — none of Harbor's or Millennium's data leaking
  into a QALICB user's own dashboard, confirming the tenancy scoping held under the new
  multi-deal data too.
- **CDE portal redesign to a wireframe**: given a low-fidelity mock of a persistent
  left-sidebar layout, redesigned the CDE portal to match it (scope explicitly limited to
  the CDE portal — asked, not assumed). `CdeLayout.tsx` gained a sticky sidebar
  (`.portal-shell`/`.portal-sidebar` in index.css, active-link styling via `NavLink`)
  with six sections: Portfolio, Review Queue, Deals, AMIS, Issues, Documents. The first
  three sub-pages didn't exist before — `CdeReviewQueueAll.tsx`, `CdeIssuesAll.tsx`,
  `CdeDocumentsAll.tsx`, `CdeAmisAll.tsx`, and `CdeDealsList.tsx` are new, each fanning
  out the existing per-deal APIs (`listReviewQueue`, `listIssues`, `listDocuments`,
  `getAmisReadiness`) across every deal the CDE participates in via `Promise.all`, so
  every sidebar link is a real, working aggregate view instead of a placeholder.

  `CdePortfolio.tsx` itself was rebuilt to match the mock's stat-card row (Assigned
  deals/Current/Late-Returned/AMIS ready) and filter bar (Deal/Status/Due-date dropdowns
  + search, all client-side over the fetched rows) with a redesigned table (Deal /
  QALICB / Next deadline / Compliance / CBR / AMIS). Every column is real data, not
  invented to match the mock cosmetically — CBR shows the actual `CbrReportingPeriod`
  status enum value (e.g. "Not started"), AMIS shows the real `X/Y ready` field count.

  Caught and fixed a real bug while verifying live: "Next deadline" was initially
  computed as the earliest *non-overdue* instance's due date, which could surface an
  already-submitted-and-approved instance's (necessarily earlier, and sometimes past)
  due date instead of the next instance actually still pending. Fixed to filter on
  status (`not_due`/`upcoming`) rather than just overdue-ness.

  Verified live end to end: the sidebar renders and every one of its six links loads
  real cross-deal data (Review Queue showed 2 pending items across 2 deals; Issues
  showed the 1 open issue from earlier CDE-notes testing; Documents showed Millennium's
  3 documents; AMIS showed each deal's real field-readiness fraction; Deals listed all
  3); the Portfolio page's search filter correctly narrowed 3 deals to 1 live in the
  browser; and the next-deadline fix was confirmed by re-checking Riverside's row
  changed from a stale past date to the correct upcoming one after the fix.
- **Same sidebar redesign extended to Impact and QALICB**: the aggregate pages built for
  CDE were refactored into shared, portal-parameterized components
  (`pages/shared/ReviewQueueAll.tsx`, `IssuesAll.tsx`, `DocumentsAll.tsx`, `AmisAll.tsx`,
  `DealsListAll.tsx`, each taking a `portal: "impact" | "cde"` prop) instead of
  duplicating near-identical CDE-only files — `CdeLayout.tsx` now uses the same
  components as Impact, just with `portal="cde"`.

  `ImpactLayout.tsx` gained the same sidebar shell with six sections: Portfolio (the
  existing Deal Portfolio, which also gained the CDE Portfolio's filter bar — Status +
  search), Review Queue, AMIS, Issues, Documents, and an Impact-exclusive **Audit Log**
  aggregate (`ImpactAuditAll.tsx` — concatenates every deal's already-200-capped audit
  list, re-sorts, caps at 200 again, so it's a real cross-deal snapshot, not a promise of
  complete history at high volume) in place of CDE's "Deals" (redundant for Impact, since
  Portfolio already is the deal list with KPIs).

  `QalicbLayout.tsx` gained a much thinner sidebar matching its actual IA: Dashboard and
  Community Benefits Report. The CBR link had no natural single URL before (the old
  dashboard link hardcoded `deals[0].id` inline) — new `QalicbCbrRedirect.tsx` resolves
  the current user's first deal and redirects, preserving that same "first deal wins"
  behavior for the (currently universal, but not enforced) case of a QALICB user with
  exactly one deal.

  Verified live for both portals: Impact's sidebar renders all six links and each loads
  real data (Review Queue correctly empty — nothing currently sitting at "submitted";
  AMIS showed all three deals' real readiness fractions; Audit Log showed 200
  cross-deal events with correct deal attribution, including entries from CDE users and
  QALICB users on different deals); the QALICB sidebar's Community Benefits Report link
  correctly redirected to Millennium Holdings' real CBR page, matching what the old
  hardcoded dashboard link used to reach.
- **CDE per-deal "Deal Overview" page**, matching a second low-fidelity wireframe (a deal
  detail screen the CDE portal never had — clicking a deal used to jump straight to its
  review queue with no landing page). New `CdeDealOverview.tsx` at `/cde/deals/:dealId`
  with the mock's four stat cards (Compliance status, Open exceptions, CBR progress,
  AMIS readiness), a requirements table (Requirement / Entity-period / Due / Impact /
  CDE columns), and a "CDE-specific deal data" side panel — scoped to *this* CDE's own
  participation specifically, not another CDE's, on a multi-CDE deal.

  Two real gaps had to be filled to make the panel work with real data instead of
  placeholders: the `Qlici` model existed in the schema but had **no API route at all**
  (new `qlicis.ts`, `GET /api/deals/:dealId/qlicis`, same `requireDealAccess` level as
  the existing `cdeParticipations` endpoint, which already exposes QEI/allocation
  amounts at that same access level — this doesn't introduce a new visibility boundary),
  and no deal had any QLICI records — seeded two real ones (`prisma/seed.ts`, so a fresh
  install gets them too; also run once against this session's live database) for
  Millennium Holdings' Enterprise Financial CDE participation.

  CBR progress is a plain, honestly-labeled completeness proxy — "how many of the three
  sections this app actually collects (profile revenue, jobs, tenants) have any data" —
  not a fabricated official percentage, since no such canonical score exists in the
  schema. Private notes count sums `IssueNote` rows visible to the viewing CDE across
  every issue on the deal (reusing the existing per-issue notes endpoint).

  Verified live: loaded Millennium Holdings as Enterprise Financial CDE and confirmed
  every panel value against known-real data — QLICI-A ($5,524,000) and QLICI-B
  ($2,396,000) matching exactly what was just seeded, allocation control number
  `22NMA003551` matching the seeded `CdeParticipation`, "3 notes" matching the sum of
  every `IssueNote` created during earlier feature testing on this deal's one issue, and
  the compliance/exceptions/AMIS stat cards matching the same real counts already
  verified on the Portfolio dashboard for this deal.
- **Review Queue redesign to a third wireframe**: `ReviewQueueAll.tsx` (shared between
  Impact and CDE) rebuilt to match — a filter bar (Deal / Priority / Due date / Search,
  all real and functional) and a table with `Received` / `Deal` / `Requirement` /
  `Period` / `Impact review` (CDE stage only — meaningless for the Impact queue, since
  Impact reviewers *are* the impact review, so the column is hidden there rather than
  shown empty) columns, plus a `Queue Summary` side panel.

  Two columns are derived from real fields rather than invented to match the mock
  cosmetically: `Received` approximates "when this item arrived in the queue" from
  `updatedAt` (the last status transition — accurate for a queue that only ever shows
  one specific status) via a `relativeDay()` helper ("Today"/"Yesterday"/"N days
  ago"/short date); `Period` derives a compact `Q2 2026` / `H1 2026` / `CY 2026` label
  from the real `reportingPeriodStart`/`reportingPeriodEnd` span instead of a raw date
  range, matching how periods are actually generated (calendar-aligned quarter/half/year
  spans in `deadlineEngine.ts`).

  The mock's "Queue filters" side panel (Assigned reviewer / Age / Deal / Priority) had
  no real backing fields for "assigned reviewer" or "age" as filters (no assignment
  concept exists on `Review`), so rather than build dead controls, it became a real
  `Queue Summary`: who's signed in, the oldest item's age, how many deals are
  represented, and a priority breakdown — all computed from the same `severity` field
  the requirement definitions already carry, not fabricated.

  Verified live for both portals: the CDE queue showed 2 real pending items across 2
  deals with correct relative dates, period labels, and a `Queue Summary` matching (2
  deals represented, both Normal priority); the Deal filter correctly narrowed the table
  to 1 row while the summary panel stayed computed from the unfiltered set (its own
  distinct data, not re-filtered); the Impact queue correctly showed 4 columns (no
  `Impact review`) and an honest empty state with real `—` placeholders when nothing was
  pending, rather than "0"/blank cells that would look like a loading bug.

- **Requirement Review redesign to a fourth wireframe**: `ReviewDetail.tsx` (shared
  between the Impact and CDE review-decision screens) rebuilt to match a "C-04
  Requirement Review" mock — header line with deal / sub-CDE (CDE portal only) /
  responsible party / period; an `Impact status` card; a `Source basis` card; the
  existing `Submitted evidence` and attestation cards; the existing decision form; and a
  right-side `Context / History` panel (submission version/date, Impact approval date,
  sharing status, full decision history, and an Impact-only audit-log link).

  The mock implied review-decision history (who decided what, when, at both stages) was
  already viewable here, but no such data was ever exposed by the API — the `Review`
  model existed with zero `GET` routes. Added `GET
  /deals/:dealId/requirement-instances/:instanceId/review` to `reviews.ts`, returning
  every review for the instance with the reviewer's email and reviewing org's name. Since
  `Review.reviewingOrganizationId` is a plain FK column with no declared Prisma relation
  to `Organization`, the route resolves names with a second small `findMany` rather than
  adding a schema relation just for this one read.

  `Source basis` renders the requirement definition's real `sources` (document name,
  section reference, excerpt) — already modeled and populated, just never surfaced on
  this screen before. `Sharing status` in the Context panel is derived from the actual
  `shareScope` of the submission's attached evidence documents (most-restrictive first),
  not a fabricated field — there's no separate "submission sharing scope" concept in the
  schema, only per-document visibility.

  Verified live: fetched a real Millennium Holdings instance
  (`69a18438-d40d-48a5-ba22-ec5ec671f2b2`, Quarterly Financial Statements, Q4 2025) as
  both the Impact compliance manager and the Enterprise Financial CDE reviewer. Impact
  view showed the correct header (`Millennium Holdings · Millennium Holdings LLC
  (borrower) · Q4 2025`), the real Impact approval (reviewer email, org name, timestamp),
  the real source citation (`QLICI Loan Agreement · §7.11(e)`), and the Impact-only audit
  link. CDE view additionally showed `Enterprise Sub-CDE 45` in the header and CDE-scoped
  comment visibility, correctly hid the audit link, and — after recording a live CDE
  approval decision through the same screen — correctly showed a second `CDE: Approved`
  status line and a two-entry `Full decision history` list, both reflecting the real new
  `Review` row.

## Before this could go anywhere near production
- A real identity provider (AWS Cognito or equivalent) replacing the local-credential JWT
  system — see the Auth section above for what's already real vs. what's still interim
- Run the S3+KMS integration against a real AWS account for the first time (see the
  Evidence storage section above) before relying on it
- Decide and build the production clamd deployment shape (sidecar/service/async Lambda —
  see docs/MALWARE_SCANNING.md) and keep its virus definitions updating on a schedule
- Expand the AMIS field catalog further toward AMIS's actual production field set (13
  real fields now covered, up from 3 — still not exhaustive) and drive it from
  `field_definitions` + `source_preference` config per the schema's original design,
  rather than the hardcoded resolver in `goldenFields.ts`
- Point SMTP at a production provider (SES/SendGrid) with real DNS/SPF/DKIM — the send path
  itself is verified (Ethereal), but not production deliverability
