import type { RoleCode } from "@prisma/client";

export interface AuthedMembership {
  organizationId: string;
  roleCode: RoleCode;
}

export interface AuthedUser {
  id: string;
  email: string;
  memberships: AuthedMembership[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}
