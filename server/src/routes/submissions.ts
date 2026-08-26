import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole } from "../middleware/auth";
import { notify, resolveDealMembers } from "../lib/notifications";

const IMPACT_REVIEWER_ROLES = ["impact_super_admin", "impact_compliance_manager", "impact_analyst"] as const;

export const submissionsRouter = Router({ mergeParams: true });

const SUBMITTER_ROLES = [
  "impact_super_admin",
  "impact_compliance_manager",
  "impact_analyst",
  "qalicb_admin",
  "qalicb_contributor",
] as const;

/**
 * Returns the current draft submission for this instance, creating one if none exists.
 * Idempotent on purpose — the QALICB portal calls this every time it opens a
 * requirement, whether or not a draft already exists (Q-03's "Draft Submitted" state).
 */
submissionsRouter.post("/draft", requireDealAccess, requireRole(...SUBMITTER_ROLES), async (req, res) => {
  const instance = await prisma.requirementInstance.findUnique({ where: { id: req.params.instanceId } });
  if (!instance || instance.dealId !== req.params.dealId) return res.status(404).json({ error: "Requirement instance not found" });

  let draft = await prisma.submission.findFirst({
    where: { requirementInstanceId: instance.id, status: "draft" },
    include: { documents: { include: { document: true } } },
  });

  if (!draft) {
    draft = await prisma.$transaction(async (tx) => {
      const nextVersion = instance.currentSubmissionVersion + 1;
      const created = await tx.submission.create({
        data: {
          requirementInstanceId: instance.id,
          submissionVersion: nextVersion,
          submittedByOrganizationId: req.user!.memberships[0]?.organizationId ?? "",
          submittedByUserId: req.user!.id,
          status: "draft",
        },
        include: { documents: { include: { document: true } } },
      });
      if (instance.status === "not_due" || instance.status === "upcoming") {
        await tx.requirementInstance.update({ where: { id: instance.id }, data: { status: "draft_submitted" } });
      }
      return created;
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "submission",
      objectId: draft.id,
      action: "create_draft",
      afterData: draft,
    });
  }

  res.json(draft);
});

const linkDocSchema = z.object({ documentId: z.string().min(1), evidenceRole: z.string().optional() });

/** Attaches an already-uploaded document to a draft submission as evidence. */
submissionsRouter.post("/:submissionId/documents", requireDealAccess, requireRole(...SUBMITTER_ROLES), async (req, res) => {
  const submission = await prisma.submission.findUnique({ where: { id: req.params.submissionId } });
  if (!submission || submission.requirementInstanceId !== req.params.instanceId) {
    return res.status(404).json({ error: "Submission not found" });
  }
  if (submission.status !== "draft") {
    return res.status(409).json({ error: "Only draft submissions accept new evidence" });
  }

  const parsed = linkDocSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // documentId comes straight from the request body — without this check, a user with
  // access to this deal could attach any document ID they've observed from a *different*
  // deal as "evidence" here, cross-linking unrelated deals' evidence and exposing the
  // other deal's document metadata through this submission's evidence list.
  const targetDoc = await prisma.document.findUnique({ where: { id: parsed.data.documentId } });
  if (!targetDoc || targetDoc.dealId !== req.params.dealId) {
    return res.status(404).json({ error: "Document not found on this deal" });
  }

  const link = await prisma.submissionDocument.create({
    data: { submissionId: submission.id, documentId: parsed.data.documentId, evidenceRole: parsed.data.evidenceRole },
  });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "submission_document",
    objectId: submission.id,
    action: "attach_evidence",
    afterData: link,
  });

  res.status(201).json(link);
});

const submitSchema = z.object({
  attestationText: z.string().min(1, "Attestation text is required"),
});

/**
 * Finalizes a submission: attests, marks submitted, and — mirroring the SQL schema's
 * protect_final_submission trigger — from this point the submission is immutable except
 * for the status transitions a review can make (returned/approved/superseded). The
 * requirement instance moves to "submitted" and its current_submission_version is bumped.
 */
submissionsRouter.post("/:submissionId/submit", requireDealAccess, requireRole(...SUBMITTER_ROLES), async (req, res) => {
  const submission = await prisma.submission.findUnique({ where: { id: req.params.submissionId } });
  if (!submission || submission.requirementInstanceId !== req.params.instanceId) {
    return res.status(404).json({ error: "Submission not found" });
  }
  if (submission.status !== "draft") {
    return res.status(409).json({ error: `Submission is already ${submission.status} — cannot resubmit` });
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "submitted",
        attestationText: parsed.data.attestationText,
        attestedByUserId: req.user!.id,
        attestedAt: now,
        submittedAt: now,
      },
    }),
    prisma.requirementInstance.update({
      where: { id: req.params.instanceId },
      data: { status: "submitted", currentSubmissionVersion: submission.submissionVersion },
    }),
  ]);

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "submission",
    objectId: submission.id,
    action: "submit",
    beforeData: submission,
    afterData: updated,
  });

  const instance = await prisma.requirementInstance.findUnique({
    where: { id: req.params.instanceId },
    include: { requirementDefinition: { select: { title: true } } },
  });
  const targets = await resolveDealMembers(req.params.dealId, [...IMPACT_REVIEWER_ROLES]);
  await notify({
    targets,
    dealId: req.params.dealId,
    requirementInstanceId: req.params.instanceId,
    notificationType: "submission_ready_for_review",
    subject: `Submission ready for review: ${instance?.requirementDefinition.title ?? "a requirement"}`,
    body: `A submission for "${instance?.requirementDefinition.title ?? "a requirement"}" was just submitted and is awaiting Impact review.`,
  });

  res.json(updated);
});
