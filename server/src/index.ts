import "dotenv/config";
// Patches Express so a rejected Promise from an async route handler reaches the error
// middleware below, instead of becoming an unhandled rejection that crashes the process
// (Node treats those as fatal — see the incident this caught during Phase 2 development).
import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { dealsRouter } from "./routes/deals";
import { dealPartiesRouter } from "./routes/dealParties";
import { cdeParticipationsRouter } from "./routes/cdeParticipations";
import { qlicisRouter } from "./routes/qlicis";
import { projectAddressesRouter } from "./routes/projectAddresses";
import { organizationsRouter } from "./routes/organizations";
import { requirementDefinitionsRouter } from "./routes/requirementDefinitions";
import { documentsRouter } from "./routes/documents";
import { auditEventsRouter } from "./routes/auditEvents";
import { requirementInstancesRouter } from "./routes/requirementInstances";
import { issuesRouter } from "./routes/issues";
import { messagesRouter } from "./routes/messages";
import { cbrRouter } from "./routes/cbr";
import { snapshotsRouter } from "./routes/snapshots";
import { amisRouter } from "./routes/amis";
import { notificationsRouter } from "./routes/notificationsRouter";
import { verifyStorageReachable } from "./lib/storage";
import { runDeadlineSweep } from "./lib/deadlineSweep";
import { runDigestSweep } from "./lib/notificationDigest";
import { runMessageOverdueSweep } from "./lib/messageSweep";

// Prisma returns BigInt for file_size_bytes; JSON.stringify can't serialize BigInt
// natively and Node treats the resulting rejection as fatal, so patch it globally
// rather than remembering to convert it at every call site.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/organizations", requireAuth, organizationsRouter);
app.use("/api/deals", requireAuth, dealsRouter);
app.use("/api/deals/:dealId/parties", requireAuth, dealPartiesRouter);
app.use("/api/deals/:dealId/cde-participations", requireAuth, cdeParticipationsRouter);
app.use("/api/deals/:dealId/qlicis", requireAuth, qlicisRouter);
app.use("/api/deals/:dealId/project-addresses", requireAuth, projectAddressesRouter);
app.use("/api/deals/:dealId/requirement-definitions", requireAuth, requirementDefinitionsRouter);
app.use("/api/deals/:dealId/documents", requireAuth, documentsRouter);
app.use("/api/deals/:dealId/audit-events", requireAuth, auditEventsRouter);
app.use("/api/deals/:dealId/requirement-instances", requireAuth, requirementInstancesRouter);
app.use("/api/deals/:dealId/issues", requireAuth, issuesRouter);
app.use("/api/deals/:dealId/messages", requireAuth, messagesRouter);
app.use("/api/deals/:dealId/cbr", requireAuth, cbrRouter);
app.use("/api/deals/:dealId/snapshots", requireAuth, snapshotsRouter);
app.use("/api/deals/:dealId/amis", requireAuth, amisRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 4100);

// Real scheduled sweep for deadline reminders — replaces relying solely on a page load
// to trigger the recompute (see lib/deadlineSweep.ts). Runs once shortly after boot, then
// on a fixed interval; a fresh embedded Postgres/seed can take a moment to settle, so the
// first run is delayed rather than firing before the DB is actually ready.
const SWEEP_INTERVAL_MS = Number(process.env.DEADLINE_SWEEP_INTERVAL_MINUTES ?? 60) * 60 * 1000;

function startDeadlineSweeper() {
  const sweep = () =>
    runDeadlineSweep()
      .then((result) => {
        if (result.totalUpdated > 0 || result.totalReminders > 0) {
          console.log(
            `Deadline sweep: ${result.dealsSwept} deal(s) checked, ${result.totalUpdated} instance(s) updated, ${result.totalReminders} reminder(s) sent.`
          );
        }
      })
      .catch((err) => console.error("Deadline sweep failed:", err));

  setTimeout(sweep, 10_000);
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

// Sends one consolidated email per user in daily-digest mode, covering everything
// notify() queued for them instead of sending immediately (see lib/notificationDigest.ts
// and the digest-frequency setting in Notification Preferences). Same interval/lock
// pattern as the deadline sweep, on its own schedule and its own advisory-lock key.
const DIGEST_INTERVAL_MS = Number(process.env.EMAIL_DIGEST_INTERVAL_MINUTES ?? 1440) * 60 * 1000;

function startDigestSweeper() {
  const sweep = () =>
    runDigestSweep()
      .then((result) => {
        if (result.usersDigested > 0) {
          console.log(`Email digest sweep: ${result.usersDigested} user(s) sent a digest covering ${result.notificationsSent} notification(s).`);
        }
      })
      .catch((err) => console.error("Email digest sweep failed:", err));

  setTimeout(sweep, 15_000);
  setInterval(sweep, DIGEST_INTERVAL_MS);
}

// Calls out message threads still open past their response date (see lib/messageSweep.ts).
// Shares the deadline sweep's interval since both answer the same question — "has a date
// passed while nobody was looking" — but runs on its own advisory-lock key and its own
// offset so the two don't start in lockstep every tick.
function startMessageSweeper() {
  const sweep = () =>
    runMessageOverdueSweep()
      .then((result) => {
        if (result.threadsFlagged > 0) {
          console.log(`Message overdue sweep: ${result.threadsFlagged} thread(s) past their response date.`);
        }
      })
      .catch((err) => console.error("Message overdue sweep failed:", err));

  setTimeout(sweep, 20_000);
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

verifyStorageReachable()
  .then(() => {
    app.listen(port, () => {
      console.log(`NMTC Compliance Platform API listening on :${port}`);
      startDeadlineSweeper();
      startDigestSweeper();
      startMessageSweeper();
    });
  })
  .catch((err) => {
    // Fail loudly at boot rather than on some user's first upload — a wrong bucket name,
    // region, or missing IAM permissions should never surface as "upload failed" three
    // requests deep into a demo.
    console.error("Evidence storage is not reachable — refusing to start.", err);
    process.exit(1);
  });
