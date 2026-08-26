import type { RoleCode } from "@prisma/client";
import { prisma } from "./prisma";
import { sendEmail } from "./email";

interface NotifyTarget {
  userId: string;
  organizationId: string;
  email: string;
}

/** Active members holding any of the given roles, across every org with access to this deal. */
export async function resolveDealMembers(dealId: string, roleCodes: RoleCode[]): Promise<NotifyTarget[]> {
  const access = await prisma.dealOrganizationAccess.findMany({ where: { dealId }, select: { organizationId: true } });
  const orgIds = access.map((a) => a.organizationId);
  if (orgIds.length === 0) return [];

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: { in: orgIds }, roleCode: { in: roleCodes }, status: "active" },
    include: { user: { select: { id: true, email: true, status: true } } },
  });

  return memberships
    .filter((m) => m.user.status === "active")
    .map((m) => ({ userId: m.userId, organizationId: m.organizationId, email: m.user.email }));
}

/**
 * Records one notification per target: an in-app row (always — visible in the
 * notification list immediately, no delivery step needed) and an email row (attempted via
 * sendEmail; its status reflects whether SMTP is configured and the send actually
 * succeeded — see email.ts for the fail-visible-not-silent rationale).
 */
export async function notify(params: {
  targets: NotifyTarget[];
  dealId?: string;
  requirementInstanceId?: string;
  notificationType: string;
  subject: string;
  body: string;
}) {
  const { targets, dealId, requirementInstanceId, notificationType, subject, body } = params;

  for (const target of targets) {
    await prisma.notification.create({
      data: {
        userId: target.userId,
        organizationId: target.organizationId,
        dealId,
        requirementInstanceId,
        notificationType,
        channel: "in_app",
        subject,
        body,
        status: "sent",
        sentAt: new Date(),
      },
    });

    const emailResult = await sendEmail({ to: target.email, subject, body });
    await prisma.notification.create({
      data: {
        userId: target.userId,
        organizationId: target.organizationId,
        dealId,
        requirementInstanceId,
        notificationType,
        channel: "email",
        subject,
        body,
        status: emailResult.status,
        sentAt: emailResult.status === "sent" ? new Date() : undefined,
        providerMessageId: emailResult.providerMessageId,
      },
    });
  }
}
