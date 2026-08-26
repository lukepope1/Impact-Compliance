import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess } from "../middleware/auth";

export const reviewsRouter = Router({ mergeParams: true });

const IMPACT_REVIEWER_ROLES = new Set(["impact_super_admin", "impact_compliance_manager", "impact_analyst"]);
const CDE_REVIEWER_ROLES = new Set(["cde_admin", "cde_reviewer"]);

const reviewSchema = z.object({
  stage: z.enum(["impact", "cde"]),
  decision: z.enum(["approved", "returned", "acknowledged", "waived"]),
  decisionNote: z.string().optional(),
});

/**
 * Records an impact or CDE review decision on a requirement instance's current
 * submission and advances the instance's status accordingly:
 *   impact approve  -> impact_approved (now visible to CDEs for their own review)
 *   impact/cde return -> returned (QALICB gets a fresh draft slot — see submissions.ts,
 *                         which always creates a new version when no "draft" submission exists)
 *   cde approve      -> cde_approved
 * A returned decision requires a note — an empty "fix this" isn't useful to the QALICB
 * side and the schema's audit trail should always explain why something bounced.
 */
reviewsRouter.post("/", requireDealAccess, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { stage, decision, decisionNote } = parsed.data;

  if (decision === "returned" && !decisionNote?.trim()) {
    return res.status(400).json({ error: "A decision note is required when returning a submission" });
  }

  const membership = req.user!.memberships.find((m) =>
    stage === "impact" ? IMPACT_REVIEWER_ROLES.has(m.roleCode) : CDE_REVIEWER_ROLES.has(m.roleCode)
  );
  if (!membership) return res.status(403).json({ error: `Not authorized to record a ${stage} review` });

  const instance = await prisma.requirementInstance.findUnique({ where: { id: req.params.instanceId } });
  if (!instance || instance.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement instance not found" });

  const expectedStatus = stage === "impact" ? "submitted" : "impact_approved";
  if (instance.status !== expectedStatus) {
    return res.status(409).json({ error: `Instance is "${instance.status}" — ${stage} review requires "${expectedStatus}"` });
  }

  const submission = await prisma.submission.findFirst({
    where: { requirementInstanceId: instance.id, submissionVersion: instance.currentSubmissionVersion },
  });

  const nextInstanceStatus =
    decision === "approved" ? (stage === "impact" ? "impact_approved" : "cde_approved") : decision === "returned" ? "returned" : instance.status;
  const nextSubmissionStatus = decision === "approved" ? "approved" : decision === "returned" ? "returned" : undefined;

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

  res.status(201).json(review);
});
