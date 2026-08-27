import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";

export const impactTargetsRouter = Router({ mergeParams: true });

const METRICS = ["permanent_jobs", "retained_jobs", "construction_jobs", "lmi_jobs", "people_served", "square_feet"] as const;

/**
 * Readable by anyone with deal access — a QALICB reporting actuals and a CDE reviewing
 * them both need to know what was committed. Writing stays with Impact staff, matching
 * the other closing-time deal data (project address, CDE participations): commitments
 * come from the allocation agreement, not from the party being measured against them.
 */
impactTargetsRouter.get("/", requireDealAccess, async (req, res) => {
  const targets = await prisma.impactTarget.findMany({
    where: { dealId: req.params.dealId },
    orderBy: { metric: "asc" },
  });
  res.json(targets);
});

const putSchema = z.object({
  targets: z.array(
    z.object({
      metric: z.enum(METRICS),
      // null clears the commitment entirely rather than storing a zero — "didn't commit
      // to this measure" and "committed to none of it" are different claims, and the
      // portfolio roll-up only counts deals that actually committed.
      committedValue: z.number().positive().nullable(),
      sourceNote: z.string().optional(),
    })
  ),
});

/**
 * Replaces the deal's commitment set in one call. The form edits all six measures
 * together, so a single save keeps them consistent — a per-metric PATCH would let a
 * half-saved set sit in the database if the user navigated away mid-edit.
 */
impactTargetsRouter.put("/", requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"), async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.impactTarget.findMany({ where: { dealId: req.params.dealId } });

  await prisma.$transaction(
    parsed.data.targets.map((t) =>
      t.committedValue === null
        ? prisma.impactTarget.deleteMany({ where: { dealId: req.params.dealId, metric: t.metric } })
        : prisma.impactTarget.upsert({
            where: { dealId_metric: { dealId: req.params.dealId, metric: t.metric } },
            create: {
              dealId: req.params.dealId,
              metric: t.metric,
              committedValue: t.committedValue,
              sourceNote: t.sourceNote?.trim() || null,
            },
            update: { committedValue: t.committedValue, sourceNote: t.sourceNote?.trim() || null },
          })
    )
  );

  const after = await prisma.impactTarget.findMany({ where: { dealId: req.params.dealId }, orderBy: { metric: "asc" } });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "impact_target",
    action: "replace",
    beforeData: { count: before.length, metrics: before.map((t) => t.metric) },
    afterData: { count: after.length, metrics: after.map((t) => t.metric) },
  });

  res.json(after);
});
