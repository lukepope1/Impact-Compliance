import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/auth";

export const organizationsRouter = Router();

/**
 * Lightweight lookup list for pickers (deal setup wizard's CDE/party selectors). This
 * returns every active organization regardless of deal — appropriate for the Impact
 * admins who use it to build out a deal's party list, but a cross-tenant directory
 * leak for anyone else (a QALICB or CDE user could otherwise enumerate every other
 * organization on the platform, including competitors). Restricted to the Impact roles
 * that actually drive the pickers this feeds.
 */
organizationsRouter.get(
  "/",
  requireRole("impact_super_admin", "impact_compliance_manager", "impact_analyst"),
  async (req, res) => {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const organizations = await prisma.organization.findMany({
      where: { status: "active", ...(type ? { organizationType: type as never } : {}) },
      orderBy: { legalName: "asc" },
    });
    res.json(organizations);
  }
);
