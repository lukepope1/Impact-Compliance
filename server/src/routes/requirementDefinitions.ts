import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";

export const requirementDefinitionsRouter = Router({ mergeParams: true });

requirementDefinitionsRouter.get("/", requireDealAccess, async (req, res) => {
  const defs = await prisma.requirementDefinition.findMany({
    where: { dealId: req.params.dealId },
    include: { sources: true },
    orderBy: [{ requirementCode: "asc" }, { version: "desc" }],
  });
  res.json(defs);
});

const createSchema = z.object({
  requirementCode: z.string().min(1),
  title: z.string().min(1),
  category: z.string(),
  cadence: z.string(),
  appliesToPartyRoles: z.array(z.string()).default([]),
  dueRule: z.record(z.any()),
  evidenceSchema: z.record(z.any()).default({}),
  severity: z.string().default("normal"),
  sources: z
    .array(
      z.object({
        sourceDocumentName: z.string(),
        sectionReference: z.string().optional(),
        sourceExcerpt: z.string().optional(),
        sourcePriority: z.number().default(100),
      })
    )
    .default([]),
});

/**
 * Creates a new draft version of a requirement definition. Published versions
 * are immutable (enforced at the DB layer in the SQL schema via a trigger; the
 * Phase 1 Prisma migration should add the equivalent constraint) — editing a
 * published requirement always means creating version N+1, never mutating N.
 */
requirementDefinitionsRouter.post(
  "/",
  requireRoleOnDealOrg("impact_compliance_manager", "impact_analyst"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const latest = await prisma.requirementDefinition.findFirst({
      where: { dealId: req.params.dealId, requirementCode: parsed.data.requirementCode },
      orderBy: { version: "desc" },
    });

    const def = await prisma.requirementDefinition.create({
      data: {
        dealId: req.params.dealId,
        requirementCode: parsed.data.requirementCode,
        version: (latest?.version ?? 0) + 1,
        title: parsed.data.title,
        category: parsed.data.category as never,
        cadence: parsed.data.cadence as never,
        appliesToPartyRoles: parsed.data.appliesToPartyRoles,
        dueRule: parsed.data.dueRule,
        evidenceSchema: parsed.data.evidenceSchema,
        severity: parsed.data.severity as never,
        createdById: req.user!.id,
        sources: { create: parsed.data.sources },
      },
      include: { sources: true },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "requirement_definition",
      objectId: def.id,
      action: "create",
      afterData: def,
    });

    res.status(201).json(def);
  }
);

/** Publishing locks the version. Requirement instances only ever generate off published versions. */
requirementDefinitionsRouter.post(
  "/:id/publish",
  requireRoleOnDealOrg("impact_compliance_manager"),
  async (req, res) => {
    const existing = await prisma.requirementDefinition.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.dealId !== req.params.dealId) {
      return res.status(404).json({ error: "Requirement definition not found" });
    }
    if (existing.status === "published") {
      return res.status(409).json({ error: "Already published" });
    }

    const def = await prisma.requirementDefinition.update({
      where: { id: req.params.id },
      data: { status: "published", publishedById: req.user!.id, publishedAt: new Date() },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "requirement_definition",
      objectId: def.id,
      action: "publish",
      beforeData: existing,
      afterData: def,
    });

    res.json(def);
  }
);

const conflictSchema = z.object({
  conflictStatus: z.enum(["none", "suspected", "confirmed", "resolved"]),
  conflictResolutionNote: z.string().min(1, "A resolution note is required whenever conflict status changes"),
});

/**
 * Records a source-conflict decision (e.g. two source documents giving different due
 * dates — see requirement_sources). The SQL schema's implementation notes require a
 * human resolution note whenever a conflict is flagged; this endpoint is the only way
 * to change conflict_status so that note can never be skipped.
 */
requirementDefinitionsRouter.patch(
  "/:id/conflict",
  requireRoleOnDealOrg("impact_compliance_manager", "impact_analyst"),
  async (req, res) => {
    const existing = await prisma.requirementDefinition.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.dealId !== req.params.dealId) {
      return res.status(404).json({ error: "Requirement definition not found" });
    }

    const parsed = conflictSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const def = await prisma.requirementDefinition.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "requirement_definition",
      objectId: def.id,
      action: "conflict_resolution",
      beforeData: existing,
      afterData: def,
    });

    res.json(def);
  }
);
