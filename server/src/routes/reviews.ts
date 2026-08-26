import { Router } from "express";
import { z } from "zod";
import type { RoleCode } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { findDealOrgMembership, requireDealAccess } from "../middleware/auth";
import { notify, resolveDealMembers } from "../lib/notifications";

export const reviewsRouter = Router({ mergeParams: true });

const IMPACT_REVIEWER_ROLES: RoleCode[] = ["impact_super_admin", "impact_compliance_manager", "impact_analyst"];
const CDE_REVIEWER_ROLES: RoleCode[] = ["cde_admin", "cde_reviewer"];

const reviewSchema = z.object({
  stage: z.enum(["impact", "cde"]),
  decision: z.enum(["approved", "returned", "acknowledged", "waived"]),
  decisionNote: z.string().optional(),
});

/**
 * Records an impact or CDE review decision on a requirement instance's current
 * submission and advances the instance's status accordingly:
 *   approved/acknowledged -> impact_approved / cde_approved (acknowledged advances the
 *                            pipeline the same way approved does — it's for items that
 *                            don't need substantive evidence review, e.g. an event notice
 *                            someone just needs to confirm they've seen, but still needs
 *                            to move the instance forward and is recorded distinctly from
 *                            "approved" for reporting)
 *   returned              -> returned (QALICB gets a fresh draft slot — see submissions.ts,
 *                            which always creates a new version when no "draft" submission exists)
 *   waived                -> waived (terminal; the only decision that doesn't require the
 *                            instance to already be in mid-review — Impact can waive a
 *                            requirement that was never submitted at all)
 * A returned or waived decision requires a note — an empty "fix this" or "never mind"
 * isn't useful, and the schema's audit trail should always explain why.
 */
reviewsRouter.post("/", requireDealAccess, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { stage, decision, decisionNote } = parsed.data;

  if ((decision === "returned" || decision === "waived") && !decisionNote?.trim()) {
    return res.status(400).json({ error: `A decision note is required to ${decision === "returned" ? "return" : "waive"} a requirement` });
  }

  // requireDealAccess only proves the user belongs to *some* org with access to this
  // deal — it does not prove the specific org backing this review does. A user who is a
  // cde_admin at an unrelated CDE could otherwise "borrow" deal access from any other
  // membership and record a binding review decision. The reviewer role set depends on
  // `stage` from the request body, so this can't be a static requireRoleOnDealOrg(...)
  // middleware — it calls the same org-scoped lookup that middleware uses, inline.
  const roles = stage === "impact" ? IMPACT_REVIEWER_ROLES : CDE_REVIEWER_ROLES;
  const found = await findDealOrgMembership(req.user!.memberships, req.params.dealId, roles);
  if (!found) return res.status(403).json({ error: `Your organization is not a party to this deal in a ${stage}-reviewer capacity` });
  const membership = found.membership;

  const instance = await prisma.requirementInstance.findUnique({ where: { id: req.params.instanceId } });
  if (!instance || instance.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement instance not found" });

  const expectedStatus = stage === "impact" ? "submitted" : "impact_approved";
  if (decision === "waived") {
    if (instance.status === "closed" || instance.status === "waived") {
      return res.status(409).json({ error: `Instance is already "${instance.status}" — nothing to waive` });
    }
  } else if (instance.status !== expectedStatus) {
    return res.status(409).json({ error: `Instance is "${instance.status}" — ${stage} review requires "${expectedStatus}"` });
  }

  const submission = await prisma.submission.findFirst({
    where: { requirementInstanceId: instance.id, submissionVersion: instance.currentSubmissionVersion },
  });

  const nextInstanceStatus =
    decision === "waived"
      ? "waived"
      : decision === "approved" || decision === "acknowledged"
        ? (stage === "impact" ? "impact_approved" : "cde_approved")
        : decision === "returned"
          ? "returned"
          : instance.status;
  const nextSubmissionStatus =
    decision === "approved" || decision === "acknowledged" ? "approved" : decision === "returned" ? "returned" : undefined;

  const [review] = await prisma.$transaction([
    prisma.review.create({
      data: {
        requirementInstanceId: instance.id,
        submissionId: submission?.id,
        reviewStage: stage,
        reviewingOrganizationId: membership.organizationId,
        reviewerUserId: req.user!.id,
        decision,
        decisionNote,
      },
    }),
    prisma.requirementInstance.update({ where: { id: instance.id }, data: { status: nextInstanceStatus as never } }),
    ...(submission && nextSubmissionStatus
      ? [
          prisma.submission.update({
            where: { id: submission.id },
            data: { status: nextSubmissionStatus as never, responseNote: decisionNote },
          }),
        ]
      : []),
  ]);

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "requirement_instance",
    objectId: instance.id,
    action: `${stage}_review_${decision}`,
    beforeData: { status: instance.status },
    afterData: { status: nextInstanceStatus, reviewId: review.id },
  });

  await sendReviewDecisionNotifications(req.params.dealId, instance.id, stage, decision, decisionNote, submission?.submittedByUserId);

  res.status(201).json(review);
});

async function sendReviewDecisionNotifications(
  dealId: string,
  requirementInstanceId: string,
  stage: "impact" | "cde",
  decision: "approved" | "returned" | "acknowledged" | "waived",
  decisionNote: string | undefined,
  submitterUserId: string | undefined
) {
  const requirementDef = await prisma.requirementInstance.findUnique({
    where: { id: requirementInstanceId },
    include: { requirementDefinition: { select: { title: true } } },
  });
  const title = requirementDef?.requirementDefinition.title ?? "a requirement";

  if (decision === "returned" && submitterUserId) {
    const submitter = await prisma.user.findUnique({ where: { id: submitterUserId }, select: { id: true, email: true } });
    const membership = submitter
      ? await prisma.organizationMembership.findFirst({ where: { userId: submitter.id, status: "active" } })
      : null;
    if (submitter && membership) {
      await notify({
        targets: [{ userId: submitter.id, organizationId: membership.organizationId, email: submitter.email }],
        dealId,
        requirementInstanceId,
        notificationType: `${stage}_review_returned`,
        subject: `Returned for revision: ${title}`,
        body: decisionNote ? `Your submission for "${title}" was returned: ${decisionNote}` : `Your submission for "${title}" was returned for revision.`,
      });
    }
  }

  if (decision === "approved" && stage === "impact") {
    // Now visible to CDEs for their own review — let them know it's waiting.
    const cdeTargets = await resolveDealMembers(dealId, ["cde_admin", "cde_reviewer"]);
    await notify({
      targets: cdeTargets,
      dealId,
      requirementInstanceId,
      notificationType: "impact_approved_awaiting_cde",
      subject: `Ready for CDE review: ${title}`,
      body: `"${title}" was approved by Impact and is now ready for CDE review.`,
    });
  }
}
