import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess } from "../middleware/auth";
import { issueNotesRouter } from "./issueNotes";

export const issuesRouter = Router({ mergeParams: true });

issuesRouter.use("/:issueId/notes", issueNotesRouter);

issuesRouter.get("/", requireDealAccess, async (req, res) => {
  const issues = await prisma.issue.findMany({
    where: { dealId: req.params.dealId },
    include: { assignedToOrganization: { select: { legalName: true } }, requirementInstance: { select: { id: true, dueDate: true } } },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
  });
  res.json(issues);
});

const createSchema = z.object({
  issueType: z.enum([
    "missing_item",
    "late_item",
    "data_variance",
    "covenant_exception",
    "source_conflict",
    "material_event_candidate",
    "amis_validation",
    "security",
    "other",
  ]),
  severity: z.enum(["low", "normal", "high", "critical"]),
  title: z.string().min(1),
  description: z.string().optional(),
  requirementInstanceId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

/** Operational tracking only — no automatic legal/recapture conclusion, per the wireframes' framing. */
issuesRouter.post("/", requireDealAccess, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // requirementInstanceId is client-supplied — without this check, a user with access to
  // this deal could link an issue here to a requirement instance that actually belongs to
  // a different deal, leaking that other deal's instance data through this deal's issue list.
  if (parsed.data.requirementInstanceId) {
    const instance = await prisma.requirementInstance.findUnique({ where: { id: parsed.data.requirementInstanceId } });
    if (!instance || instance.dealId !== req.params.dealId) {
      return res.status(404).json({ error: "Requirement instance not found on this deal" });
    }
  }

  const issue = await prisma.issue.create({
    data: { dealId: req.params.dealId, ...parsed.data, assignedToOrganizationId: req.user!.memberships[0]?.organizationId },
  });

  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "issue", objectId: issue.id, action: "create", afterData: issue });
  res.status(201).json(issue);
});

const resolveSchema = z.object({ resolution: z.string().min(1) });

issuesRouter.post("/:issueId/resolve", requireDealAccess, async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.issue.findUnique({ where: { id: req.params.issueId } });
  if (!existing || existing.dealId !== req.params.dealId) return res.status(404).json({ error: "Issue not found" });

  const issue = await prisma.issue.update({
    where: { id: req.params.issueId },
    data: { status: "resolved", resolution: parsed.data.resolution, resolvedAt: new Date() },
  });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "issue",
    objectId: issue.id,
    action: "resolve",
    beforeData: existing,
    afterData: issue,
  });

  res.json(issue);
});
