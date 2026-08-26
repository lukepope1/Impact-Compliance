import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireDealAccess } from "../middleware/auth";

export const qlicisRouter = Router({ mergeParams: true });

/**
 * Read-only for now — QLICI records aren't created through this app yet (no seed data
 * populates them for most demo deals either, so an empty list here is often the honest
 * answer, not a bug). Same access level as cdeParticipations.ts: any org with deal
 * access can see every QLICI on the deal, matching how CDE participation amounts
 * (qeiAmount/allocationAmount) are already visible to QALICB via that same endpoint —
 * this doesn't introduce a new visibility boundary, it's consistent with the existing one.
 */
qlicisRouter.get("/", requireDealAccess, async (req, res) => {
  const qlicis = await prisma.qlici.findMany({
    where: { dealId: req.params.dealId },
    include: { cdeParticipation: { select: { cdeOrganizationId: true, subCdeName: true } } },
    orderBy: { qliciCode: "asc" },
  });
  res.json(qlicis);
});
