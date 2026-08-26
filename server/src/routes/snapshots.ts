import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";
import { ensureFieldDefinition, resolveGoldenValues } from "../lib/goldenFields";

export const snapshotsRouter = Router({ mergeParams: true });

snapshotsRouter.get("/:year", requireDealAccess, async (req, res) => {
  const snapshot = await prisma.sharedOutcomeSnapshot.findFirst({
    where: { dealId: req.params.dealId, reportingPeriodEnd: new Date(Date.UTC(Number(req.params.year), 11, 31)) },
    orderBy: { snapshotVersion: "desc" },
    include: {
      values: { include: { fieldDefinition: true } },
      approvals: { include: { cdeParticipation: { include: { cdeOrganization: true } } } },
      controlledByCdeParticipation: { include: { cdeOrganization: true } },
    },
  });
  res.json(snapshot);
});

/**
 * Creates the next version of the shared golden-record snapshot for a reporting year,
 * pulling current values from the deal's CBR data. Every participating CDE gets a fresh
 * pending approval row — a new snapshot version always resets approvals rather than
 * carrying forward a stale "approved" against numbers that just changed.
 */
snapshotsRouter.post(
  "/:year/generate",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const year = Number(req.params.year);
    const reportingPeriodEnd = new Date(Date.UTC(year, 11, 31));

    const [deal, participations, latest] = await Promise.all([
      prisma.deal.findUnique({ where: { id: req.params.dealId } }),
      prisma.cdeParticipation.findMany({ where: { dealId: req.params.dealId } }),
      prisma.sharedOutcomeSnapshot.findFirst({
        where: { dealId: req.params.dealId, reportingPeriodEnd },
        orderBy: { snapshotVersion: "desc" },
      }),
    ]);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    if (participations.length === 0) return res.status(422).json({ error: "Deal has no CDE participations to share a snapshot with" });

    const golden = await resolveGoldenValues(req.params.dealId, year);
    const leadCde = participations.find((p) => p.isLeadCde) ?? participations[0];

    const snapshot = await prisma.sharedOutcomeSnapshot.create({
      data: {
        dealId: req.params.dealId,
        reportingPeriodEnd,
        snapshotVersion: (latest?.snapshotVersion ?? 0) + 1,
        status: "impact_approved",
        controlledByCdeParticipationId: leadCde.id,
        createdById: req.user!.id,
        values: {
          create: await Promise.all(
            golden.map(async (g) => {
              const fieldDefinition = await ensureFieldDefinition(g.fieldCode, g.label, g.dataType);
              return {
                fieldDefinitionId: fieldDefinition.id,
                valueText: g.dataType === "text" ? String(g.value ?? "") : undefined,
                valueNumber: g.dataType !== "text" ? (g.value as number | undefined) : undefined,
              };
            })
          ),
        },
        approvals: { create: participations.map((p) => ({ cdeParticipationId: p.id, decision: "pending" as const })) },
      },
      include: { values: { include: { fieldDefinition: true } }, approvals: true },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "shared_outcome_snapshot",
      objectId: snapshot.id,
      action: "generate",
      afterData: { version: snapshot.snapshotVersion, fieldCount: golden.length },
    });

    res.status(201).json(snapshot);
  }
);

const approveSchema = z.object({
  decision: z.enum(["approved", "changes_requested", "not_reporting"]),
  decisionNote: z.string().optional(),
});

/** A CDE's own approval decision on the shared snapshot — does not affect other CDEs' rows. */
snapshotsRouter.post("/:snapshotId/approve", requireRoleOnDealOrg("cde_admin", "cde_reviewer"), async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const membership = res.locals.dealOrgMembership as { organizationId: string };
  const participation = await prisma.cdeParticipation.findFirst({
    where: { dealId: req.params.dealId, cdeOrganizationId: membership.organizationId },
  });
  if (!participation) return res.status(403).json({ error: "This organization is not a CDE participant on this deal" });

  const snapshot = await prisma.sharedOutcomeSnapshot.findUnique({ where: { id: req.params.snapshotId } });
  if (!snapshot || snapshot.dealId !== req.params.dealId) return res.status(404).json({ error: "Snapshot not found" });

  const approval = await prisma.cdeSnapshotApproval.update({
    where: { snapshotId_cdeParticipationId: { snapshotId: snapshot.id, cdeParticipationId: participation.id } },
    data: { decision: parsed.data.decision, decisionNote: parsed.data.decisionNote, decidedById: req.user!.id, decidedAt: new Date() },
  });

  const allApprovals = await prisma.cdeSnapshotApproval.findMany({ where: { snapshotId: snapshot.id } });
  if (allApprovals.every((a) => a.decision === "approved" || a.decision === "not_reporting")) {
    await prisma.sharedOutcomeSnapshot.update({ where: { id: snapshot.id }, data: { status: "locked", lockedAt: new Date() } });
  }

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "cde_snapshot_approval",
    objectId: approval.id,
    action: "decide",
    afterData: approval,
  });

  res.json(approval);
});
