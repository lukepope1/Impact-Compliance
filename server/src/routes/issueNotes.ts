import { Router } from "express";
import { z } from "zod";
import type { IssueNote } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess } from "../middleware/auth";

export const issueNotesRouter = Router({ mergeParams: true });

/**
 * org_private means "only the authoring org and Impact," scoped to the specific org that
 * wrote it — not "shared with every org of the same type" (a CDE's private note stays
 * private from every *other* CDE on a multi-CDE deal, not just from QALICB). This is the
 * whole point of the feature: a note distinct from the issue's shared title/description.
 */
function canSeeNote(note: IssueNote, userOrgIds: string[], isImpactUser: boolean): boolean {
  if (isImpactUser) return true;
  if (userOrgIds.includes(note.authorOrganizationId)) return true;
  return note.visibility === "deal_shared";
}

issueNotesRouter.get("/", requireDealAccess, async (req, res) => {
  const issue = await prisma.issue.findUnique({ where: { id: req.params.issueId } });
  if (!issue || issue.dealId !== req.params.dealId) return res.status(404).json({ error: "Issue not found" });

  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const orgs = await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, organizationType: true } });
  const isImpactUser = orgs.some((o) => o.organizationType === "impact_marketplace");

  const notes = await prisma.issueNote.findMany({
    where: { issueId: req.params.issueId },
    include: { authorUser: { select: { email: true } }, authorOrganization: { select: { legalName: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(notes.filter((n) => canSeeNote(n, orgIds, isImpactUser)));
});

const createSchema = z.object({
  body: z.string().min(1),
  visibility: z.enum(["org_private", "deal_shared"]).default("org_private"),
});

issueNotesRouter.post("/", requireDealAccess, async (req, res) => {
  const issue = await prisma.issue.findUnique({ where: { id: req.params.issueId } });
  if (!issue || issue.dealId !== req.params.dealId) return res.status(404).json({ error: "Issue not found" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const authorOrgId = req.user!.memberships[0]?.organizationId;
  if (!authorOrgId) return res.status(403).json({ error: "No organization membership to attribute this note to" });

  const note = await prisma.issueNote.create({
    data: {
      issueId: req.params.issueId,
      dealId: req.params.dealId,
      authorUserId: req.user!.id,
      authorOrganizationId: authorOrgId,
      visibility: parsed.data.visibility,
      body: parsed.data.body,
    },
    include: { authorUser: { select: { email: true } }, authorOrganization: { select: { legalName: true } } },
  });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "issue_note",
    objectId: note.id,
    action: "create",
    afterData: { issueId: req.params.issueId, visibility: note.visibility },
  });

  res.status(201).json(note);
});
