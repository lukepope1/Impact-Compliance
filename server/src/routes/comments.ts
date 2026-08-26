import { Router } from "express";
import { z } from "zod";
import type { Comment, Organization } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess } from "../middleware/auth";
import { orgTypeMap } from "../lib/documentAccess";

export const commentsRouter = Router({ mergeParams: true });

/**
 * Same enforcement pattern as canAccessDocument — visibility is checked here, not
 * trusted from the client, since a comment thread is exactly the kind of place a QALICB
 * user could otherwise read a CDE's or Impact's private notes about their own submission.
 */
function canSeeComment(comment: Comment, userOrgIds: string[], orgTypesById: Map<string, Organization["organizationType"]>): boolean {
  const hasImpactOrg = userOrgIds.some((id) => orgTypesById.get(id) === "impact_marketplace");
  if (hasImpactOrg) return true;
  if (userOrgIds.includes(comment.authorOrganizationId)) return true;

  switch (comment.visibility) {
    case "deal_shared":
      return true;
    case "qalicb_shared":
      return userOrgIds.some((id) => orgTypesById.get(id) === "qalicb" || orgTypesById.get(id) === "borrower");
    case "cde_private":
      return userOrgIds.some((id) => orgTypesById.get(id) === "cde");
    case "impact_private":
      return false; // already excluded above
    default:
      return false;
  }
}

commentsRouter.get("/", requireDealAccess, async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const types = await orgTypeMap(orgIds);

  const comments = await prisma.comment.findMany({
    where: { dealId: req.params.dealId, requirementInstanceId: req.params.instanceId },
    include: { authorUser: { select: { email: true, firstName: true, lastName: true } }, authorOrganization: { select: { legalName: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(comments.filter((c) => canSeeComment(c, orgIds, types)));
});

const createSchema = z.object({
  body: z.string().min(1),
  visibility: z.enum(["qalicb_shared", "deal_shared", "impact_private", "cde_private"]),
});

commentsRouter.post("/", requireDealAccess, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const instance = await prisma.requirementInstance.findUnique({ where: { id: req.params.instanceId } });
  if (!instance || instance.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement instance not found" });

  // impact_private/cde_private only make sense coming from that org type — a QALICB user
  // marking a note "impact_private" would create a comment nobody but Impact could ever
  // see, including the QALICB author's own org on a later visit (they're not impact staff).
  const authorOrgId = req.user!.memberships[0]?.organizationId;
  const authorOrgType = authorOrgId ? (await orgTypeMap([authorOrgId])).get(authorOrgId) : undefined;
  if (parsed.data.visibility === "impact_private" && authorOrgType !== "impact_marketplace") {
    return res.status(403).json({ error: "Only Impact staff can post impact_private comments" });
  }
  if (parsed.data.visibility === "cde_private" && authorOrgType !== "cde" && authorOrgType !== "impact_marketplace") {
    return res.status(403).json({ error: "Only CDE staff can post cde_private comments" });
  }

  const comment = await prisma.comment.create({
    data: {
      dealId: req.params.dealId,
      requirementInstanceId: req.params.instanceId,
      authorUserId: req.user!.id,
      authorOrganizationId: authorOrgId!,
      visibility: parsed.data.visibility,
      body: parsed.data.body,
    },
    include: { authorUser: { select: { email: true, firstName: true, lastName: true } }, authorOrganization: { select: { legalName: true } } },
  });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "comment",
    objectId: comment.id,
    action: "create",
    afterData: { visibility: comment.visibility },
  });

  res.status(201).json(comment);
});
