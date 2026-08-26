# Phased build plan

Derived from the developer handoff (blueprint, backlog, schema, wireframes) and the README's
own sprint plan. Each phase must work end-to-end before the next starts — versioning and
immutability are painful to retrofit, so the foundation gets the most care.

## Phase 0 — Foundation (this commit)
- Repo scaffold: server (Express + TS + Prisma/Postgres), client (React + TS + Vite)
- Full canonical data model as Prisma schema, 1:1 with `NMTC_Phase_1_Database_Schema.sql`
- Auth scaffold: session/user model, org-scoped membership, role checking middleware
- Seed script with one sample deal (Millennium Holdings, matching the wireframes)

## Phase 1 — Tenancy, deal configuration, requirement definitions (Sprint 1)
- Organizations, users, memberships, deal CRUD, deal party/CDE participation setup
- Requirement definition builder (versioned, with source-clause lineage + conflict flagging)
- Impact Marketplace admin screens: deal setup wizard (I-02), requirement builder (I-03)

## Phase 2 — Evidence & audit (Sprint 2)
- Document upload → S3 (private, SSE-KMS) with version lineage, checksum, malware-scan status
- Document access grants (share-scope enforcement server-side)
- Audit event log wired into every mutation

## Phase 3 — Deadline engine & requirement instances (Sprint 3)
- Requirement instance generator from due_rule JSON (fixed dates / days-after / on-request)
- Conflict resolution workflow, overdue/upcoming calculation

## Phase 4 — QALICB portal (Sprint 4)
- Dashboard, compliance tasks, requirement detail & upload, submission review & attestation
- Submissions immutable once submitted (DB trigger mirrors the SQL schema's protection)

## Phase 5 — Review & CDE portal (Sprint 5)
- Impact review queue, return/resubmit workflow
- CDE portfolio dashboard, review queue, requirement review, documents, issues

## Phase 6 — CBR, AMIS, Multi-CDE, pilot hardening (Sprint 6)
- Community Benefits Report builder (jobs, benefits, tenants, service outcomes)
- Multi-CDE shared outcome snapshots + per-CDE approval
- AMIS field mapping versions + review XLSX / CSV export generation (manual filing only —
  Phase 1 never auto-submits to AMIS)
- Security review, UAT against the backlog's acceptance criteria

## Explicit non-goals for Phase 1
- No direct AMIS API integration or auto-certification
- No legal/recapture determination logic — issues are operational flags, not conclusions
- No sharing of CDE-private data across CDE organizations
