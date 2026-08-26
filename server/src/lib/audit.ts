import { prisma } from "./prisma";
import type { Request } from "express";

/** Every mutating route should call this after a successful write — see Phase 2 of the plan. */
export async function recordAuditEvent(
  req: Request,
  params: {
    dealId?: string | null;
    objectType: string;
    objectId?: string | null;
    action: string;
    beforeData?: unknown;
    afterData?: unknown;
  }
) {
  await prisma.auditEvent.create({
    data: {
      actorUserId: req.user?.id,
      actorOrganizationId: req.user?.memberships[0]?.organizationId,
      dealId: params.dealId ?? undefined,
      objectType: params.objectType,
      objectId: params.objectId ?? undefined,
      action: params.action,
      beforeData: params.beforeData as never,
      afterData: params.afterData as never,
      requestId: req.header("x-request-id") ?? undefined,
      ipAddress: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    },
  });
}
