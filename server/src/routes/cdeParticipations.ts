import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole } from "../middleware/auth";

export const cdeParticipationsRouter = Router({ mergeParams: true });

cdeParticipationsRouter.get("/", requireDealAccess, async (req, res) => {
  const participations = await prisma.cdeParticipation.findMany({
    where: { dealId: req.params.dealId },
    include: { cdeOrganization: true, allocateeOrganization: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(participations);
});

const createSchema = z.object({
  cdeOrganizationId: z.string().min(1),
  allocateeOrganizationId: z.string().optional(),
  subCdeName: z.string().optional(),
  allocationControlNumber: z.string().optional(),
  qeiAmount: z.number().optional(),
  allocationAmount: z.number().optional(),
  isLeadCde: z.boolean().default(false),
});

/**
 * Adds a CDE to the deal. Grants that CDE's organization deal-level access at the same
 * time — a CDE participation without deal_organization_access would be invisible to that
 * CDE's users, which the wireframes never intend (every CDE screen assumes membership).
 */
cdeParticipationsRouter.post(
  "/",
  requireDealAccess,
  requireRole("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.isLeadCde) {
      const existingLead = await prisma.cdeParticipation.findFirst({
        where: { dealId: req.params.dealId, isLeadCde: true },
      });
      if (existingLead) {
        return res.status(409).json({ error: "Deal already has a lead CDE" });
      }
    }

    const participation = await prisma.$transaction(async (tx) => {
      const created = await tx.cdeParticipation.create({
        data: { dealId: req.params.dealId, ...parsed.data },
        include: { cdeOrganization: true },
      });

      await tx.dealOrganizationAccess.upsert({
        where: {
          dealId_organizationId_dealRole: {
            dealId: req.params.dealId,
            organizationId: parsed.data.cdeOrganizationId,
            dealRole: "cde",
          },
        },
        create: {
          dealId: req.params.dealId,
          organizationId: parsed.data.cdeOrganizationId,
          dealRole: "cde",
          canViewSharedEvidence: true,
          canReview: true,
          canApprove: true,
        },
        update: {},
      });

      return created;
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "cde_participation",
      objectId: participation.id,
      action: "create",
      afterData: participation,
    });

    res.status(201).json(participation);
  }
);
