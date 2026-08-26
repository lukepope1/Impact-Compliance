import type { PrismaClient } from "@prisma/client";

/**
 * Two more QALICB orgs/deals/users, both participating with Enterprise Financial CDE —
 * so the CDE portfolio dashboard and the Impact deal portfolio have more than one row to
 * actually demonstrate what "multiple" looks like, instead of every dashboard screenshot
 * being a single-deal, single-QALICB demo. Shares seed.ts's exact data shape
 * (organizationAccess / cdeParticipations created inline on the deal, same requirement
 * definition pattern) so a fresh `npm run seed` and this script produce identical results
 * — this is called from seed.ts's main() for fresh installs, and can also be run standalone
 * (`npx tsx prisma/additionalQalicbs.ts`) against an already-seeded database.
 */
export async function seedAdditionalQalicbs(
  prisma: PrismaClient,
  args: { passwordHash: string; impactId: string; enterpriseCdeId: string; complianceManagerId: string }
) {
  const { passwordHash, impactId, enterpriseCdeId, complianceManagerId } = args;

  const riverside = await prisma.organization.create({
    data: { organizationType: "qalicb", legalName: "Riverside Manufacturing LLC" },
  });
  await prisma.user.create({
    data: {
      externalAuthSubject: "seed|qalicb-admin-riverside",
      email: "mchen@riversidemfg.example",
      passwordHash,
      firstName: "Mike",
      lastName: "Chen",
      memberships: { create: { organizationId: riverside.id, roleCode: "qalicb_admin" } },
    },
  });

  const riversideDeal = await prisma.deal.create({
    data: {
      dealCode: "RIVER-2025",
      legalName: "Riverside Manufacturing",
      projectName: "Riverside Manufacturing Expansion",
      status: "active",
      closingDate: new Date("2025-03-14"),
      complianceStartDate: new Date("2025-03-14"),
      complianceEndDate: new Date("2032-03-14"),
      isMultiCde: false,
      createdById: complianceManagerId,
      organizationAccess: {
        create: [
          { organizationId: impactId, dealRole: "impact_manager", canViewSharedEvidence: true, canSubmit: true, canReview: true, canApprove: true, canExport: true },
          { organizationId: riverside.id, dealRole: "qalicb", canViewSharedEvidence: true, canSubmit: true },
          { organizationId: enterpriseCdeId, dealRole: "cde", canViewSharedEvidence: true, canReview: true, canApprove: true, canExport: true },
        ],
      },
      cdeParticipations: {
        create: [{ cdeOrganizationId: enterpriseCdeId, allocationControlNumber: "23NMA004102", isLeadCde: true }],
      },
      parties: {
        create: [{ organizationId: riverside.id, legalName: "Riverside Manufacturing LLC", partyRole: "borrower", isReportingParty: true }],
      },
    },
  });

  const riversideReqDef = await prisma.requirementDefinition.create({
    data: {
      dealId: riversideDeal.id,
      requirementCode: "QUARTERLY_FINANCIALS",
      version: 1,
      title: "Quarterly Financial Statements",
      category: "document_collection",
      cadence: "quarterly",
      appliesToPartyRoles: ["borrower"],
      dueRule: { type: "days_after_period_end", days: 45 },
      evidenceSchema: { requiredDocumentTypes: ["balance_sheet", "income_statement", "cash_flow_statement"] },
      severity: "normal",
      status: "published",
      createdById: complianceManagerId,
      publishedById: complianceManagerId,
      publishedAt: new Date(),
      sources: { create: [{ sourceDocumentName: "QLICI Loan Agreement", sectionReference: "§7.11(e)", sourcePriority: 100 }] },
    },
  });

  const harbor = await prisma.organization.create({
    data: { organizationType: "qalicb", legalName: "Harbor Health Clinic Inc" },
  });
  await prisma.user.create({
    data: {
      externalAuthSubject: "seed|qalicb-admin-harbor",
      email: "rpatel@harborhealth.example",
      passwordHash,
      firstName: "Raj",
      lastName: "Patel",
      memberships: { create: { organizationId: harbor.id, roleCode: "qalicb_admin" } },
    },
  });

  const harborDeal = await prisma.deal.create({
    data: {
      dealCode: "HARBOR-2026",
      legalName: "Harbor Health Clinic",
      projectName: "Harbor Community Health Center",
      status: "onboarding",
      closingDate: new Date("2026-05-01"),
      complianceStartDate: new Date("2026-05-01"),
      complianceEndDate: new Date("2033-05-01"),
      isMultiCde: false,
      createdById: complianceManagerId,
      organizationAccess: {
        create: [
          { organizationId: impactId, dealRole: "impact_manager", canViewSharedEvidence: true, canSubmit: true, canReview: true, canApprove: true, canExport: true },
          { organizationId: harbor.id, dealRole: "qalicb", canViewSharedEvidence: true, canSubmit: true },
          { organizationId: enterpriseCdeId, dealRole: "cde", canViewSharedEvidence: true, canReview: true, canApprove: true, canExport: true },
        ],
      },
      cdeParticipations: {
        create: [{ cdeOrganizationId: enterpriseCdeId, allocationControlNumber: "26NMA000871", isLeadCde: true }],
      },
      parties: {
        create: [{ organizationId: harbor.id, legalName: "Harbor Health Clinic Inc", partyRole: "borrower", isReportingParty: true }],
      },
    },
  });

  const harborReqDef = await prisma.requirementDefinition.create({
    data: {
      dealId: harborDeal.id,
      requirementCode: "QUARTERLY_FINANCIALS",
      version: 1,
      title: "Quarterly Financial Statements",
      category: "document_collection",
      cadence: "quarterly",
      appliesToPartyRoles: ["borrower"],
      dueRule: { type: "days_after_period_end", days: 45 },
      evidenceSchema: { requiredDocumentTypes: ["balance_sheet", "income_statement", "cash_flow_statement"] },
      severity: "normal",
      status: "published",
      createdById: complianceManagerId,
      publishedById: complianceManagerId,
      publishedAt: new Date(),
      sources: { create: [{ sourceDocumentName: "QLICI Loan Agreement", sectionReference: "§6.9(c)", sourcePriority: 100 }] },
    },
  });

  return { riverside, riversideDeal, riversideReqDef, harbor, harborDeal, harborReqDef };
}
