import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// One shared dev password across all seeded demo users — fine for local dev only, never
// reuse this pattern anywhere real credentials matter.
const DEV_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const impact = await prisma.organization.create({
    data: { organizationType: "impact_marketplace", legalName: "Impact Marketplace LLC" },
  });
  const qalicb = await prisma.organization.create({
    data: { organizationType: "qalicb", legalName: "Millennium Holdings LLC" },
  });
  const enterpriseCde = await prisma.organization.create({
    data: { organizationType: "cde", legalName: "Enterprise Financial CDE" },
  });
  const hrvCde = await prisma.organization.create({
    data: { organizationType: "cde", legalName: "HRV Sub-CDE 62" },
  });

  const complianceManager = await prisma.user.create({
    data: {
      externalAuthSubject: "seed|compliance-manager",
      email: "compliance@impactmarketplace.com",
      passwordHash,
      firstName: "Impact",
      lastName: "Manager",
      memberships: { create: { organizationId: impact.id, roleCode: "impact_compliance_manager" } },
    },
  });

  await prisma.user.create({
    data: {
      externalAuthSubject: "seed|qalicb-admin",
      email: "jane.doe@millenniumholdings.example",
      passwordHash,
      firstName: "Jane",
      lastName: "Doe",
      memberships: { create: { organizationId: qalicb.id, roleCode: "qalicb_admin" } },
    },
  });

  await prisma.user.create({
    data: {
      externalAuthSubject: "seed|cde-reviewer",
      email: "reviewer@enterprisecde.example",
      passwordHash,
      firstName: "Enterprise",
      lastName: "Reviewer",
      memberships: { create: { organizationId: enterpriseCde.id, roleCode: "cde_reviewer" } },
    },
  });

  const deal = await prisma.deal.create({
    data: {
      dealCode: "MILL-2025",
      legalName: "Millennium Holdings",
      projectName: "Millennium Holdings",
      closingDate: new Date("2025-10-06"),
      complianceStartDate: new Date("2025-10-06"),
      complianceEndDate: new Date("2032-10-06"),
      isMultiCde: true,
      createdById: complianceManager.id,
      organizationAccess: {
        create: [
          { organizationId: impact.id, dealRole: "impact_manager", canViewSharedEvidence: true, canSubmit: true, canReview: true, canApprove: true, canExport: true },
          { organizationId: qalicb.id, dealRole: "qalicb", canViewSharedEvidence: true, canSubmit: true },
          { organizationId: enterpriseCde.id, dealRole: "cde", canViewSharedEvidence: true, canReview: true, canApprove: true, canExport: true },
          { organizationId: hrvCde.id, dealRole: "cde", canViewSharedEvidence: true, canReview: true, canApprove: true },
        ],
      },
      cdeParticipations: {
        create: [
          { cdeOrganizationId: enterpriseCde.id, subCdeName: "Enterprise Sub-CDE 45", allocationControlNumber: "22NMA003551", isLeadCde: false },
          { cdeOrganizationId: hrvCde.id, subCdeName: "HRV Sub-CDE 62", isLeadCde: true },
        ],
      },
    },
  });

  await prisma.dealParty.createMany({
    data: [
      { dealId: deal.id, organizationId: qalicb.id, legalName: "Millennium Holdings LLC", partyRole: "borrower", isReportingParty: true },
      { dealId: deal.id, legalName: "Separate project business", partyRole: "project_business" },
    ],
  });

  const requirementDef = await prisma.requirementDefinition.create({
    data: {
      dealId: deal.id,
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
      createdById: complianceManager.id,
      publishedById: complianceManager.id,
      publishedAt: new Date(),
      sources: {
        create: [{ sourceDocumentName: "QLICI Loan Agreement", sectionReference: "§7.11(e)", sourcePriority: 100 }],
      },
    },
  });

  await prisma.requirementInstance.create({
    data: {
      dealId: deal.id,
      requirementDefinitionId: requirementDef.id,
      definitionVersion: 1,
      reportingPeriodStart: new Date("2026-04-01"),
      reportingPeriodEnd: new Date("2026-06-30"),
      dueDate: new Date("2026-09-30"),
      status: "upcoming",
    },
  });

  console.log("Seeded:", { deal: deal.dealCode, organizations: 4, users: 3 });
  console.log(`Demo login password for all seeded users: ${DEV_PASSWORD}`);
  console.log("  compliance@impactmarketplace.com  (Impact compliance manager)");
  console.log("  jane.doe@millenniumholdings.example  (QALICB admin)");
  console.log("  reviewer@enterprisecde.example  (CDE reviewer)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
