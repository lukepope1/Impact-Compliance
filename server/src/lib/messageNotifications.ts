import type { MessageVisibility, RoleCode } from "@prisma/client";
import { notify, resolveDealMembers } from "./notifications";

const IMPACT_ROLES: RoleCode[] = ["impact_super_admin", "impact_compliance_manager", "impact_analyst"];
const QALICB_ROLES: RoleCode[] = ["qalicb_admin", "qalicb_contributor"];
const CDE_ROLES: RoleCode[] = ["cde_admin", "cde_reviewer", "cde_viewer"];

/**
 * Who gets told about a thread, per audience. Deliberately mirrors canSeeMessage() in
 * routes/messages.ts — notifying someone about a message they then can't open would be
 * worse than staying quiet. Impact appears in every row because Impact can read every
 * thread on its deals.
 *
 * This lives here rather than in the route because the overdue sweep (lib/messageSweep.ts)
 * needs the identical mapping; two copies would eventually disagree with each other and
 * with canSeeMessage.
 */
export const AUDIENCE_ROLES: Record<MessageVisibility, RoleCode[]> = {
  qalicb_shared: [...QALICB_ROLES, ...IMPACT_ROLES],
  deal_shared: [...QALICB_ROLES, ...IMPACT_ROLES, ...CDE_ROLES],
  cde_private: [...CDE_ROLES, ...IMPACT_ROLES],
};

export type MessageNotificationType = "message_received" | "message_replied" | "message_overdue";

/** " A response is due by 2026-09-01." — appended to a notification body so the deadline travels with the alert. */
export function dueSuffix(dueDate: Date | null) {
  if (!dueDate) return "";
  return ` A response is due by ${dueDate.toISOString().slice(0, 10)}.`;
}

/**
 * Notifies everyone who can see a thread, optionally excluding the person who just acted —
 * they know what they did. Only the acting *user* is excluded rather than their whole
 * organization, so a colleague at the same org still finds out a request landed. The
 * sweep passes no actingUserId, since an overdue thread isn't anyone's action.
 */
export async function notifyThreadAudience(params: {
  dealId: string;
  visibility: MessageVisibility;
  actingUserId?: string;
  notificationType: MessageNotificationType;
  subject: string;
  body: string;
}) {
  const all = await resolveDealMembers(params.dealId, AUDIENCE_ROLES[params.visibility]);
  const targets = params.actingUserId ? all.filter((t) => t.userId !== params.actingUserId) : all;
  if (targets.length === 0) return;

  await notify({
    targets,
    dealId: params.dealId,
    notificationType: params.notificationType,
    subject: params.subject,
    body: params.body,
  });
}
