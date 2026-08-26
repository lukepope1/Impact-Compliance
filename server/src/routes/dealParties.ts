import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";

export const dealPartiesRouter = Router({ mergeParams: true });

dealPartiesRouter.get("/", requireDealAccess, async (req, res) => {
  const parties = await prisma.dealParty.findMany({
    where: { dealId: req.params.dealId },
    orderBy: { createdAt: "asc" },
  });
  res.json(parties);
});

const createSchema = z.object({
  legalName: z.string().min(1),
  partyRole: z.string(),
  organizationId: z.string().optional(),
  isReportingParty: z.boolean().default(false),
  naicsCode: z.string().optional(),
  entityType: z.string().optional(),
});

dealPartiesRouter.post(
  "/",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId } });
      if (!org) return res.status(400).json({ error: "organizationId does not refer to a known organization" });
    }

    const party = await prisma.dealParty.create({
      data: { dealId: req.params.dealId, ...parsed.data, partyRole: parsed.data.partyRole as never },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "deal_party",
      objectId: party.id,
      action: "create",
      afterData: party,
    });

    res.status(201).json(party);
  }
);
