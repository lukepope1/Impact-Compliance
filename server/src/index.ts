import "dotenv/config";
// Patches Express so a rejected Promise from an async route handler reaches the error
// middleware below, instead of becoming an unhandled rejection that crashes the process
// (Node treats those as fatal — see the incident this caught during Phase 2 development).
import "express-async-errors";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./middleware/auth";
import { dealsRouter } from "./routes/deals";
import { dealPartiesRouter } from "./routes/dealParties";
import { cdeParticipationsRouter } from "./routes/cdeParticipations";
import { organizationsRouter } from "./routes/organizations";
import { requirementDefinitionsRouter } from "./routes/requirementDefinitions";
import { documentsRouter } from "./routes/documents";
import { auditEventsRouter } from "./routes/auditEvents";
import { requirementInstancesRouter } from "./routes/requirementInstances";

// Prisma returns BigInt for file_size_bytes; JSON.stringify can't serialize BigInt
// natively and Node treats the resulting rejection as fatal, so patch it globally
// rather than remembering to convert it at every call site.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/organizations", requireAuth, organizationsRouter);
app.use("/api/deals", requireAuth, dealsRouter);
app.use("/api/deals/:dealId/parties", requireAuth, dealPartiesRouter);
app.use("/api/deals/:dealId/cde-participations", requireAuth, cdeParticipationsRouter);
app.use("/api/deals/:dealId/requirement-definitions", requireAuth, requirementDefinitionsRouter);
app.use("/api/deals/:dealId/documents", requireAuth, documentsRouter);
app.use("/api/deals/:dealId/audit-events", requireAuth, auditEventsRouter);
app.use("/api/deals/:dealId/requirement-instances", requireAuth, requirementInstancesRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 4100);
app.listen(port, () => {
  console.log(`NMTC Compliance Platform API listening on :${port}`);
});
