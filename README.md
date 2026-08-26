# NMTC Compliance Platform

A standalone compliance-reporting platform for NMTC deals: deal-configurable requirement
tracking, versioned evidence, QALICB and CDE portals, Community Benefits Reports, and
controlled AMIS export files.

This is a **separate product** from the Impact Marketplace CRM — separate repo, separate
database, no shared code or shared runtime. It reuses none of the CRM's Prisma models.

## Stack

- **server/** — Node + TypeScript + Express + Prisma (PostgreSQL)
- **client/** — React + TypeScript + Vite

## Status: Phase 1, Sprint 0-2 foundation

See `docs/PHASED_PLAN.md` for the roadmap and what's built so far.

## Getting started

See [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) for the full start/stop flow (embedded Postgres,
no Docker or system install required). Quick version:

```bash
npm run install:all
cp server/.env.example server/.env
cd server && npm run db:local        # separate terminal — leave running
cd server && npm run prisma:migrate && npm run seed
npm run dev                          # from repo root — starts API + client together
```

Server runs on `:4100`, client dev server on `:5173` (proxies `/api` to the server; Vite
picks the next free port if 5173 is taken).
