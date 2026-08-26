import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole, requireRoleOnDealOrg } from "../middleware/auth";

export const dealsRouter = Router();

/** Deals visible to the current user, across every organization they belong to. */
dealsRouter.get("/", async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const deals = await prisma.deal.findMany({
    where: { organizationAccess: { some: { organizationId: { in: orgIds } } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(deals);
});

dealsRouter.get("/:dealId", requireDealAccess, async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: {
      parties: true,
      cdeParticipations: { include: { cdeOrganization: true } },
      projectAddresses: true,
    },
  });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  res.json(deal);
});

const createDealSchema = z.object({
  dealCode: z.string().min(1),
  legalName: z.string().min(1),
  projectName: z.string().optional(),
  closingDate: z.coerce.date().optional(),
  complianceStartDate: z.coerce.date().optional(),
  complianceEndDate: z.coerce.date().optional(),
  isMultiCde: z.boolean().default(false),
});

/** Impact Marketplace staff only — the QALICB/CDE portals never create deals. */
dealsRouter.post("/", requireRole("impact_super_admin", "impact_compliance_manager"), async (req, res) => {
  const parsed = createDealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const deal = await prisma.deal.create({
    data: { ...parsed.data, createdById: req.user!.id },
  });

  await recordAuditEvent(req, { dealId: deal.id, objectType: "deal", objectId: deal.id, action: "create", afterData: deal });
  res.status(201).json(deal);
});

const updateDealSchema = createDealSchema.partial().extend({
  status: z.enum(["onboarding", "active", "exception", "winding_down", "closed", "archived"]).optional(),
  multiCdeProjectNumber: z.string().optional(),
});

dealsRouter.patch(
  "/:dealId",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const parsed = updateDealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const before = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
    const deal = await prisma.deal.update({ where: { id: req.params.dealId }, data: parsed.data });

    await recordAuditEvent(req, { dealId: deal.id, objectType: "deal", objectId: deal.id, action: "update", beforeData: before, afterData: deal });
    res.json(deal);
  }
);
