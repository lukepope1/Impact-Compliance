import type { Document, DocumentAccessGrant, Organization } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Server-side share_scope enforcement — the point the schema's implementation notes
 * insist on ("enforce authorization in the service layer for every query/download").
 * Every document list/download route must filter through this; the client is never
 * trusted to only ask for what it should see.
 */
export async function canAccessDocument(
  doc: Document,
  userOrgIds: string[],
  orgTypesById: Map<string, Organization["organizationType"]>
): Promise<boolean> {
  if (doc.ownerOrganizationId && userOrgIds.includes(doc.ownerOrganizationId)) return true;

  const hasImpactOrg = userOrgIds.some((id) => orgTypesById.get(id) === "impact_marketplace");
  if (hasImpactOrg) return true;

  switch (doc.shareScope) {
    case "impact_only":
      return false; // already excluded above
    case "qalicb_and_impact":
      return userOrgIds.some((id) => orgTypesById.get(id) === "qalicb" || orgTypesById.get(id) === "borrower");
    case "deal_shared": {
      // Every current caller already runs requireDealAccess before reaching here, so this
      // is redundant today — but this function is exported and documents itself as *the*
      // enforcement point, so it shouldn't rely on every future caller remembering that.
      // Re-derive it directly: deal_shared means shared with orgs that have been granted
      // canViewSharedEvidence on this specific document's deal, not merely "some deal."
      if (!doc.dealId) return false;
      const access = await prisma.dealOrganizationAccess.findFirst({
        where: { dealId: doc.dealId, organizationId: { in: userOrgIds }, canViewSharedEvidence: true },
      });
      return !!access;
    }
    case "selected_cdes":
    case "cde_private": {
      const grant = await prisma.documentAccessGrant.findFirst({
        where: { documentId: doc.id, organizationId: { in: userOrgIds }, revokedAt: null },
      });
      return !!grant;
    }
    default:
      return false;
  }
}

export async function orgTypeMap(orgIds: string[]) {
  const orgs = await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, organizationType: true } });
  return new Map(orgs.map((o) => [o.id, o.organizationType] as const));
}

export type { DocumentAccessGrant };
