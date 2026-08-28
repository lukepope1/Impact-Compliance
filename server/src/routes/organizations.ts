import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
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

const renameSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().max(200).optional().nullable(),
});

/**
 * Renames an organization.
 *
 * Unlike almost everything else in this app, this is not deal-scoped: an organization's
 * legal name is one row shared by every deal it appears on, so a correction here changes
 * how that CDE reads everywhere at once. That is usually the point — a misspelled or
 * since-renamed CDE should be fixed once, not per deal — but it makes this a heavier action
 * than the per-deal fields beside it, so it is limited to Impact's two admin roles rather
 * than every Impact user, and the audit entry records both names.
 *
 * Deliberately does not touch organizationType or status: changing what an organization
 * *is*, or retiring it, are different operations with different consequences for the deals
 * referencing it.
 */
organizationsRouter.patch(
  "/:organizationId",
  requireRole("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await prisma.organization.findUnique({ where: { id: req.params.organizationId } });
    if (!existing) return res.status(404).json({ error: "Organization not found" });

    const updated = await prisma.organization.update({
      where: { id: existing.id },
      data: {
        legalName: parsed.data.legalName,
        ...(parsed.data.displayName === undefined ? {} : { displayName: parsed.data.displayName || null }),
      },
    });

    await recordAuditEvent(req, {
      objectType: "organization",
      objectId: updated.id,
      action: "rename",
      beforeData: { legalName: existing.legalName, displayName: existing.displayName },
      afterData: { legalName: updated.legalName, displayName: updated.displayName },
    });

    res.json(updated);
  }
);
