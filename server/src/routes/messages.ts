import { Router } from "express";
import { z } from "zod";
import type { Message, MessageVisibility, Organization, RoleCode } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess } from "../middleware/auth";
import { orgTypeMap } from "../lib/documentAccess";
import { notify, resolveDealMembers } from "../lib/notifications";

export const messagesRouter = Router({ mergeParams: true });

const IMPACT_ROLES: RoleCode[] = ["impact_super_admin", "impact_compliance_manager", "impact_analyst"];
const QALICB_ROLES: RoleCode[] = ["qalicb_admin", "qalicb_contributor"];
const CDE_ROLES: RoleCode[] = ["cde_admin", "cde_reviewer", "cde_viewer"];

/**
 * Who gets told about a thread, per audience. Deliberately mirrors canSeeMessage() below
 * — notifying someone about a message they then can't open would be worse than staying
 * quiet. Impact appears in every row because Impact can read every thread on its deals.
 */
const AUDIENCE_ROLES: Record<MessageVisibility, RoleCode[]> = {
  qalicb_shared: [...QALICB_ROLES, ...IMPACT_ROLES],
  deal_shared: [...QALICB_ROLES, ...IMPACT_ROLES, ...CDE_ROLES],
  cde_private: [...CDE_ROLES, ...IMPACT_ROLES],
};

function dueSuffix(dueDate: Date | null) {
  if (!dueDate) return "";
  return ` A response is due by ${dueDate.toISOString().slice(0, 10)}.`;
}

/**
 * Notifies everyone who can see a thread, except the person who just acted — they know
 * what they did. Only the acting *user* is excluded rather than their whole organization,
 * so a colleague at the same org still finds out a request landed.
 */
async function notifyThreadAudience(params: {
  dealId: string;
  visibility: MessageVisibility;
  actingUserId: string;
  notificationType: "message_received" | "message_replied";
  subject: string;
  body: string;
}) {
  const targets = (await resolveDealMembers(params.dealId, AUDIENCE_ROLES[params.visibility])).filter(
    (t) => t.userId !== params.actingUserId
  );
  if (targets.length === 0) return;

  await notify({
    targets,
    dealId: params.dealId,
    notificationType: params.notificationType,
    subject: params.subject,
    body: params.body,
  });
}

const MESSAGE_INCLUDE = {
  fromUser: { select: { email: true, firstName: true, lastName: true } },
  fromOrganization: { select: { legalName: true } },
  requirementInstance: { select: { id: true, requirementDefinition: { select: { title: true } } } },
} as const;

/** Same visibility model as comments.ts's canSeeComment, minus impact_private — a request thread always includes at least the sender and recipient, so an Impact-only-visible "request" wouldn't be a request to anyone. */
function canSeeMessage(message: Message, userOrgIds: string[], orgTypesById: Map<string, Organization["organizationType"]>): boolean {
  const hasImpactOrg = userOrgIds.some((id) => orgTypesById.get(id) === "impact_marketplace");
  if (hasImpactOrg) return true;
  if (userOrgIds.includes(message.fromOrganizationId)) return true;

  switch (message.visibility) {
    case "deal_shared":
      return true;
    case "qalicb_shared":
      return userOrgIds.some((id) => orgTypesById.get(id) === "qalicb" || orgTypesById.get(id) === "borrower");
    case "cde_private":
      return userOrgIds.some((id) => orgTypesById.get(id) === "cde");
    default:
      return false;
  }
}

/** Root threads only, each with its replies nested — the list view shows one row per thread. */
messagesRouter.get("/", requireDealAccess, async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const types = await orgTypeMap(orgIds);

  const threads = await prisma.message.findMany({
    where: { dealId: req.params.dealId, parentMessageId: null },
    include: { ...MESSAGE_INCLUDE, replies: { include: MESSAGE_INCLUDE, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const visible = threads
    .filter((t) => canSeeMessage(t, orgIds, types))
    .map((t) => ({ ...t, replies: t.replies.filter((r) => canSeeMessage(r, orgIds, types)) }));

  res.json(visible);
});

const createSchema = z.object({
  visibility: z.enum(["qalicb_shared", "deal_shared", "cde_private"]),
  subject: z.string().min(1),
  body: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  slaDays: z.number().int().positive().optional(),
  requirementInstanceId: z.string().optional(),
});

/**
 * Starts a new request thread. dueDate can be given explicitly or derived from slaDays
 * (calendar days from now) — mirrors the on-request RequirementInstance flow's own
 * responseDays-to-dueDate derivation in requirementInstances.ts, so a message's SLA
 * behaves the same way an evidence request's does.
 */
messagesRouter.post("/", requireDealAccess, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.requirementInstanceId) {
    const instance = await prisma.requirementInstance.findUnique({ where: { id: parsed.data.requirementInstanceId } });
    if (!instance || instance.dealId !== req.params.dealId) {
      return res.status(404).json({ error: "Requirement instance not found on this deal" });
    }
  }

  const fromOrgId = req.user!.memberships[0]?.organizationId;
  const fromOrgType = fromOrgId ? (await orgTypeMap([fromOrgId])).get(fromOrgId) : undefined;
  if (parsed.data.visibility === "cde_private" && fromOrgType !== "cde" && fromOrgType !== "impact_marketplace") {
    return res.status(403).json({ error: "Only CDE staff can start a cde_private request" });
  }

  const dueDate = parsed.data.dueDate ?? (parsed.data.slaDays ? new Date(Date.now() + parsed.data.slaDays * 86400000) : undefined);

  const message = await prisma.message.create({
    data: {
      dealId: req.params.dealId,
      requirementInstanceId: parsed.data.requirementInstanceId,
      fromUserId: req.user!.id,
      fromOrganizationId: fromOrgId!,
      visibility: parsed.data.visibility,
      subject: parsed.data.subject,
      body: parsed.data.body,
      dueDate,
      slaDays: parsed.data.slaDays,
    },
    include: MESSAGE_INCLUDE,
  });

  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "message", objectId: message.id, action: "create" });

  await notifyThreadAudience({
    dealId: req.params.dealId,
    visibility: message.visibility,
    actingUserId: req.user!.id,
    notificationType: "message_received",
    subject: `New request: ${message.subject}`,
    body: `${message.fromOrganization.legalName} sent a request: ${message.body}${dueSuffix(message.dueDate)}`,
  });

  res.status(201).json(message);
});

const replySchema = z.object({ body: z.string().min(1) });

/**
 * Replying is the "respond" action. Status only moves when the reply comes from a
 * different org than whoever currently "has the ball": a reply from someone other than
 * the thread's original sender hands it back to the sender ("returned"); a reply from the
 * original sender while it's sitting "returned" hands it back to the recipient ("open").
 * A reply from the sender while already "open" (adding more context) is a no-op on status.
 */
messagesRouter.post("/:messageId/reply", requireDealAccess, async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const root = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!root || root.dealId !== req.params.dealId || root.parentMessageId) {
    return res.status(404).json({ error: "Message thread not found" });
  }
  if (root.status === "closed") return res.status(409).json({ error: "This thread is closed" });

  const fromOrgId = req.user!.memberships[0]?.organizationId!;
  const isSender = fromOrgId === root.fromOrganizationId;
  const nextStatus = isSender ? (root.status === "returned" ? "open" : root.status) : "returned";

  const [reply] = await prisma.$transaction([
    prisma.message.create({
      data: {
        dealId: req.params.dealId,
        parentMessageId: root.id,
        fromUserId: req.user!.id,
        fromOrganizationId: fromOrgId,
        visibility: root.visibility,
        body: parsed.data.body,
      },
      include: MESSAGE_INCLUDE,
    }),
    prisma.message.update({ where: { id: root.id }, data: { status: nextStatus as never } }),
  ]);

  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "message", objectId: reply.id, action: "reply" });

  // Uses the root thread's visibility, not the reply's own copy of it, so the audience
  // can't drift apart from the thread it belongs to.
  await notifyThreadAudience({
    dealId: req.params.dealId,
    visibility: root.visibility,
    actingUserId: req.user!.id,
    notificationType: "message_replied",
    subject: `Reply on: ${root.subject ?? "a request"}`,
    body: `${reply.fromOrganization.legalName} replied: ${reply.body}${dueSuffix(root.dueDate)}`,
  });

  res.status(201).json(reply);
});

/** Closing is the sender's (or Impact's) call — matches how a lender/CDE closes out their own information request once satisfied. */
messagesRouter.post("/:messageId/close", requireDealAccess, async (req, res) => {
  const root = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!root || root.dealId !== req.params.dealId || root.parentMessageId) {
    return res.status(404).json({ error: "Message thread not found" });
  }

  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const types = await orgTypeMap(orgIds);
  const hasImpactOrg = orgIds.some((id) => types.get(id) === "impact_marketplace");
  if (!orgIds.includes(root.fromOrganizationId) && !hasImpactOrg) {
    return res.status(403).json({ error: "Only the requesting organization or Impact staff can close this thread" });
  }

  const updated = await prisma.message.update({ where: { id: root.id }, data: { status: "closed" }, include: MESSAGE_INCLUDE });
  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "message", objectId: updated.id, action: "close" });
  res.json(updated);
});
