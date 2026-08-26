import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../lib/authTokens";

/**
 * Verifies a signed JWT from the Authorization header (see routes/auth.ts for how it's
 * issued) and loads the user's active memberships onto req.user. This is the local-
 * credential interim — the swap-out point for a real IdP (AWS Cognito or equivalent, per
 * the schema's implementation notes) is authTokens.ts, not here; this function's shape
 * (verify a token, load the user, attach memberships) stays the same either way.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  let payload;
  try {
    payload = verifyAccessToken(authHeader.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { memberships: { where: { status: "active" }, select: { organizationId: true, roleCode: true } } },
  });

  if (!user || user.status !== "active") {
    return res.status(401).json({ error: "Unknown or inactive user" });
  }

  req.user = {
    id: user.id,
    email: user.email,
    memberships: user.memberships,
  };
  next();
}

/** Restricts a route to users holding at least one of the given roles, in any organization. */
export function requireRole(...roles: RoleCode[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasRole = req.user?.memberships.some((m) => roles.includes(m.roleCode));
    if (!hasRole) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    next();
  };
}

/**
 * Loads deal-scoped access for the current user and attaches it as
 * `res.locals.dealAccess`. Every deal-scoped route must call this — it is the
 * server-side enforcement point for share_scope / can_view_shared_evidence etc.
 * (mirrors the `v_user_deal_access` view in the SQL schema).
 */
export async function requireDealAccess(req: Request, res: Response, next: NextFunction) {
  const dealId = req.params.dealId;
  const orgIds = req.user?.memberships.map((m) => m.organizationId) ?? [];

  const access = await prisma.dealOrganizationAccess.findFirst({
    where: { dealId, organizationId: { in: orgIds } },
  });

  if (!access) {
    return res.status(403).json({ error: "No access to this deal" });
  }

  res.locals.dealAccess = access;
  next();
}
