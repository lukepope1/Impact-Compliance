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

## What's deliberately out of scope for this build
- No direct AMIS API integration or auto-certification
- No legal/recapture determination logic — issues are operational flags, not conclusions
- No sharing of CDE-private data across CDE organizations
- AMIS export covers a small hardcoded field set (goldenFields.ts) proving the mechanism,
  not the full field catalog a production build would need
- No security review / formal UAT pass — see below

## Before this could go anywhere near production
- A real identity provider (AWS Cognito or equivalent) replacing the local-credential JWT
  system — see the Auth section above for what's already real vs. what's still interim
- Run the S3+KMS integration against a real AWS account for the first time (see the
  Evidence storage section above) before relying on it
- A real malware-scan pipeline — uploads are currently marked "clean" immediately
- Expand the AMIS field catalog and mapping config beyond the three proof-of-mechanism fields
- Security review and UAT against the original backlog's acceptance criteria
