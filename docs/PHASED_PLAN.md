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
- No sharing of CDE-private data across CDE organizations
- AMIS export covers a small hardcoded field set (goldenFields.ts) proving the mechanism,
  not the full field catalog a production build would need

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

## Before this could go anywhere near production
- A real identity provider (AWS Cognito or equivalent) replacing the local-credential JWT
  system — see the Auth section above for what's already real vs. what's still interim
- Run the S3+KMS integration against a real AWS account for the first time (see the
  Evidence storage section above) before relying on it
- Decide and build the production clamd deployment shape (sidecar/service/async Lambda —
  see docs/MALWARE_SCANNING.md) and keep its virus definitions updating on a schedule
- Expand the AMIS field catalog and mapping config beyond the three proof-of-mechanism fields
- Point SMTP at a production provider (SES/SendGrid) with real DNS/SPF/DKIM — the send path
  itself is verified (Ethereal), but not production deliverability
