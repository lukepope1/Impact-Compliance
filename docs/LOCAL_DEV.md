# Local development: start / stop

Three independent processes, each in its own terminal (or run in the background as this
session does). Order matters on first start; after that, order doesn't matter as long as
the database is up before the server.

## Start

**1. Database** (embedded Postgres — no Docker or system install; port 5434; data persists
in `server/.pgdata`):

```bash
cd server
npm run db:local
```

Leave this running. First run initializes the cluster and creates the `nmtc_compliance`
database — you'll see `Local PostgreSQL running on postgresql://postgres:postgres@localhost:5434/nmtc_compliance`.

**2. API server** (port 4100):

```bash
cd server
npm run dev
```

**3. Client** (port 5173, or the next free port if something else is already using it —
check the terminal output for the actual URL):

```bash
cd client
npm run dev
```

First time only, before step 2/3 will do anything useful:

```bash
npm run install:all          # from repo root
cp server/.env.example server/.env   # then set a real JWT_SECRET, or keep the placeholder for local-only use
cd server && npm run prisma:migrate   # applies migrations to the local DB
npm run seed                          # loads the sample deal + demo users (see below)
```

Or from the repo root, once the database is already running: `npm run dev` starts both
the API and client together (see root `package.json`).

## Signing in

The app requires a real login — visit the client and sign in, or use the demo-account
buttons on the login page. `npm run seed` prints the three demo accounts and prints the
shared password (`password123`) they all share:

| Email | Portal / role |
|---|---|
| compliance@impactmarketplace.com | Impact compliance manager |
| jane.doe@millenniumholdings.example | QALICB admin (Millennium Holdings) |
| reviewer@enterprisecde.example | CDE reviewer (Enterprise Financial CDE) |

Auth is a self-issued JWT signed with `JWT_SECRET` (bcrypt-hashed passwords, `POST
/api/auth/login`) — a real, working login, not a header stub — standing in for a real
identity provider (AWS Cognito or equivalent) until that's wired up. See the comments in
`server/src/lib/authTokens.ts` for the swap-out point.

Only one user is logged in per browser session, same as it would be for real — to test a
different portal, log out and sign in as a different demo account rather than expecting
all three portals to work simultaneously in one tab.

## Stop

- **API / client**: `Ctrl+C` in their terminal.
- **Database**: `Ctrl+C` in its terminal — this calls `pg_ctl stop` cleanly via the
  `localdb.ts` shutdown handler. Data persists in `server/.pgdata` for next time.

If a database terminal was killed forcefully (not `Ctrl+C`) rather than stopped cleanly,
the Postgres process can be left running detached in the background even though its
terminal is gone. Symptom: `npm run db:local` fails with `another postmaster (PID ...) is
running`. Fix — find and stop the orphaned process:

```bash
# Windows
netstat -ano | findstr :5434       # note the PID in the last column
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :5434                      # note the PID
kill <pid>
```

Then `npm run db:local` again to reattach normally.

## Resetting local data

To wipe local dev data and start clean:

```bash
cd server
rm -rf .pgdata     # stop db:local first
npm run db:local   # re-initializes on next start
npm run prisma:migrate
npm run seed
```

## Port reference

| Process | Port | Notes |
|---|---|---|
| Embedded Postgres | 5434 | Deliberately different from the CRM's embedded Postgres (5433) so both can run at once |
| API server | 4100 | |
| Client (Vite) | 5173 | Vite auto-increments (5174, 5175, ...) if the port is taken |
