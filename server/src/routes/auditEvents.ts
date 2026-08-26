import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireDealAccess, requireRole } from "../middleware/auth";

export const auditEventsRouter = Router({ mergeParams: true });

/** Impact Marketplace staff only — the audit trail itself is not shared with QALICB/CDE portals. */
auditEventsRouter.get(
  "/",
  requireDealAccess,
  requireRole("impact_super_admin", "impact_compliance_manager", "impact_analyst"),
  async (req, res) => {
    const events = await prisma.auditEvent.findMany({
      where: { dealId: req.params.dealId },
      include: { actorUser: { select: { email: true } }, actorOrganization: { select: { legalName: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    res.json(events);
  }
);
