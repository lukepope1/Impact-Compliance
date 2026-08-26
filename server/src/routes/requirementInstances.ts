import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole } from "../middleware/auth";
import { generatePeriods, computeIsOverdue, computeDisplayStatus, type DueRule } from "../lib/deadlineEngine";

export const requirementInstancesRouter = Router({ mergeParams: true });

/** Applies the overdue/upcoming recompute (normally a scheduled job) and returns the fresh rows. */
requirementInstancesRouter.get("/", requireDealAccess, async (req, res) => {
  const now = new Date();
  const instances = await prisma.requirementInstance.findMany({
    where: { dealId: req.params.dealId },
    include: {
      requirementDefinition: { select: { title: true, category: true, severity: true } },
      responsibleParty: { select: { legalName: true, partyRole: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });

  const updates = [];
  for (const inst of instances) {
    const displayStatus = computeDisplayStatus(inst.status, inst.dueDate, now);
    const overdue = computeIsOverdue(inst.dueDate, inst.status, now);
    if (displayStatus !== inst.status || overdue !== inst.isOverdue) {
      updates.push(
        prisma.requirementInstance.update({
          where: { id: inst.id },
          data: { status: displayStatus as never, isOverdue: overdue },
        })
      );
      inst.status = displayStatus as never;
      inst.isOverdue = overdue;
    }
  }
  if (updates.length) await prisma.$transaction(updates);

  res.json(instances);
});

/**
 * Generates requirement_instances for a published requirement definition across the
 * deal's compliance window. Idempotent — the DB's unique constraint on
 * (requirement_definition_id, responsible_party_id, reporting_period_start,
 * reporting_period_end, due_date) means re-running this after periods change just fills
 * in new ones, it never duplicates existing instances.
 */
requirementInstancesRouter.post(
  "/generate/:requirementDefinitionId",
  requireDealAccess,
  requireRole("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const def = await prisma.requirementDefinition.findUnique({ where: { id: req.params.requirementDefinitionId } });
    if (!def || def.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement definition not found" });
    if (def.status !== "published") return res.status(409).json({ error: "Only published requirement definitions generate instances" });

    const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    if (!deal.complianceStartDate || !deal.complianceEndDate) {
      return res.status(422).json({ error: "Deal is missing compliance start/end dates — set them before generating instances" });
    }

    let periods;
    try {
      periods = generatePeriods(def.cadence, def.dueRule as unknown as DueRule, deal.complianceStartDate, deal.complianceEndDate);
    } catch (e) {
      return res.status(422).json({ error: (e as Error).message });
    }

    const responsibleParties = def.appliesToPartyRoles.length
      ? await prisma.dealParty.findMany({ where: { dealId: deal.id, partyRole: { in: def.appliesToPartyRoles as never[] } } })
      : [null]; // no party-role restriction — a single deal-level instance

    // Prisma's compound-unique where input rejects `null` for a nullable column (Postgres
    // unique indexes don't treat NULLs as equal, so Prisma won't let you query by one) —
    // upsert() can't express "match responsiblePartyId IS NULL", so find-then-create/update by hand.
    let created = 0;
    for (const party of responsibleParties) {
      for (const period of periods) {
        const existing = await prisma.requirementInstance.findFirst({
          where: {
            requirementDefinitionId: def.id,
            responsiblePartyId: party?.id ?? null,
            reportingPeriodStart: period.periodStart,
            reportingPeriodEnd: period.periodEnd,
            dueDate: period.dueDate,
          },
        });
        if (existing) continue;

        await prisma.requirementInstance.create({
          data: {
            dealId: deal.id,
            requirementDefinitionId: def.id,
            definitionVersion: def.version,
            responsiblePartyId: party?.id,
            reportingPeriodStart: period.periodStart,
            reportingPeriodEnd: period.periodEnd,
            dueDate: period.dueDate,
            dueDateBasis: { generatedFrom: def.dueRule, at: new Date().toISOString() },
            status: computeDisplayStatus("not_due", period.dueDate, new Date()) as never,
            isOverdue: computeIsOverdue(period.dueDate, "not_due", new Date()),
          },
        });
        created++;
      }
    }

    await recordAuditEvent(req, {
      dealId: deal.id,
      objectType: "requirement_definition",
      objectId: def.id,
      action: "generate_instances",
      afterData: { periodsConsidered: periods.length, partiesConsidered: responsibleParties.length, created },
    });

    res.status(201).json({ periodsConsidered: periods.length, created });
  }
);

const requestSchema = z.object({ responseDays: z.number().int().positive().default(5) });

/** on_request requirements have no scheduled due date — this creates the instance the moment it's actually asked for. */
requirementInstancesRouter.post(
  "/request/:requirementDefinitionId",
  requireDealAccess,
  requireRole("impact_super_admin", "impact_compliance_manager", "impact_analyst"),
  async (req, res) => {
    const def = await prisma.requirementDefinition.findUnique({ where: { id: req.params.requirementDefinitionId } });
    if (!def || def.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement definition not found" });
    if (def.cadence !== "on_request") return res.status(409).json({ error: "This requirement is not on_request cadence" });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const requestedAt = new Date();
    const dueDate = new Date(requestedAt);
    dueDate.setUTCDate(dueDate.getUTCDate() + parsed.data.responseDays);

    const instance = await prisma.requirementInstance.create({
      data: {
        dealId: req.params.dealId,
        requirementDefinitionId: def.id,
        definitionVersion: def.version,
        requestedAt,
        dueDate,
        dueDateBasis: { responseDays: parsed.data.responseDays },
        status: "upcoming",
      },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "requirement_instance",
      objectId: instance.id,
      action: "request",
      afterData: instance,
    });

    res.status(201).json(instance);
  }
);
