import { prisma } from "./prisma";

/**
 * The AMIS/cross-CDE fields this build resolves automatically from deal, CDE, QLICI,
 * project-address, and CBR data. A real Phase 2+ build would drive this from
 * field_definitions + structured source_preference config per the schema; hardcoding the
 * resolution here keeps this scoped to proving the snapshot/export mechanics against a
 * realistic field set rather than building a full generic field-resolution engine.
 *
 * Deal/CDE/QLICI-level fields (closing date, QEI, QLICI principal, project number,
 * address, allocation control number) resolve the same regardless of reporting year —
 * they describe the deal itself, not a specific year's activity. Only the CBR-sourced
 * fields (revenue, jobs, NOI, tenants) are actually year-scoped.
 */
export interface GoldenField {
  fieldCode: string;
  label: string;
  dataType: "text" | "integer" | "currency" | "date";
  value: string | number | null;
  source: string;
}

/**
 * Groups the golden fields into the buckets a CDE would chase up, so a portfolio view can
 * say "8 job fields missing" instead of listing 13 field codes. Derived from where each
 * field actually comes from (the `source` strings below), not invented categories —
 * chasing "Jobs" means going back to the QALICB's CBR jobs section, which is a different
 * conversation from chasing a missing project address.
 */
export const AMIS_FIELD_CATEGORY: Record<string, string> = {
  jobs_created_actual: "Jobs",
  jobs_retained_actual: "Jobs",
  jobs_construction_actual: "Jobs",
  tenant_count: "Community impacts",
  annual_gross_revenue: "QALICB financial data",
  annual_net_operating_income: "QALICB financial data",
  project_census_tract: "Addresses / geocoding",
  project_city_state: "Addresses / geocoding",
  multi_cde_project_number: "Deal & CDE data",
  project_closing_date: "Deal & CDE data",
  total_qei_amount: "Deal & CDE data",
  total_qlici_original_principal: "Deal & CDE data",
  lead_cde_allocation_control_number: "Deal & CDE data",
};

function sumDecimal(values: (import("@prisma/client").Prisma.Decimal | null)[]): number | null {
  const nums = values.filter((v): v is import("@prisma/client").Prisma.Decimal => v !== null).map((v) => Number(v));
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
}

export async function resolveGoldenValues(dealId: string, year: number): Promise<GoldenField[]> {
  const [deal, period, cdeParticipations, qlicis, addresses] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId } }),
    prisma.cbrReportingPeriod.findUnique({
      where: { dealId_calendarYear: { dealId, calendarYear: year } },
      include: { projectProfile: true, jobRecords: true, tenantOccupants: true },
    }),
    prisma.cdeParticipation.findMany({ where: { dealId } }),
    prisma.qlici.findMany({ where: { dealId } }),
    prisma.projectAddress.findMany({ where: { dealId } }),
  ]);

  const jobsByStatus = (status: "created" | "retained" | "construction") =>
    period && period.jobRecords.length > 0
      ? period.jobRecords.filter((j) => j.jobStatus === status).reduce((sum, j) => sum + Number(j.fteCount), 0)
      : null;

  const leadCde = cdeParticipations.find((p) => p.isLeadCde) ?? cdeParticipations[0];
  const primaryAddress = addresses.find((a) => a.addressType === "primary") ?? addresses[0];

  return [
    {
      fieldCode: "annual_gross_revenue",
      label: "Annual Gross Revenue",
      dataType: "currency",
      value: period?.projectProfile?.annualGrossRevenue ? Number(period.projectProfile.annualGrossRevenue) : null,
      source: "CBR Project Profile",
    },
    {
      fieldCode: "annual_net_operating_income",
      label: "Annual Net Operating Income",
      dataType: "currency",
      value: period?.projectProfile?.annualNetOperatingIncome ? Number(period.projectProfile.annualNetOperatingIncome) : null,
      source: "CBR Project Profile",
    },
    {
      fieldCode: "jobs_created_actual",
      label: "Actual Jobs Created",
      dataType: "integer",
      value: jobsByStatus("created"),
      source: "CBR Jobs & Workforce",
    },
    {
      fieldCode: "jobs_retained_actual",
      label: "Actual Jobs Retained",
      dataType: "integer",
      value: jobsByStatus("retained"),
      source: "CBR Jobs & Workforce",
    },
    {
      fieldCode: "jobs_construction_actual",
      label: "Actual Construction Jobs",
      dataType: "integer",
      value: jobsByStatus("construction"),
      source: "CBR Jobs & Workforce",
    },
    {
      fieldCode: "tenant_count",
      label: "Tenants / Occupants Reported",
      dataType: "integer",
      value: period ? period.tenantOccupants.length : null,
      source: "CBR Tenants & Occupants",
    },
    {
      fieldCode: "multi_cde_project_number",
      label: "Multi-CDE Project Number",
      dataType: "text",
      value: deal?.multiCdeProjectNumber ?? null,
      source: "Deal record",
    },
    {
      fieldCode: "project_closing_date",
      label: "Closing Date",
      dataType: "date",
      value: deal?.closingDate ? deal.closingDate.toISOString().slice(0, 10) : null,
      source: "Deal record",
    },
    {
      fieldCode: "total_qei_amount",
      label: "Total QEI Amount",
      dataType: "currency",
      value: sumDecimal(cdeParticipations.map((p) => p.qeiAmount)),
      source: "CDE Participations",
    },
    {
      fieldCode: "total_qlici_original_principal",
      label: "Total QLICI Original Principal",
      dataType: "currency",
      value: sumDecimal(qlicis.map((q) => q.originalPrincipal)),
      source: "QLICIs",
    },
    {
      fieldCode: "lead_cde_allocation_control_number",
      label: "Lead CDE Allocation Control Number",
      dataType: "text",
      value: leadCde?.allocationControlNumber ?? null,
      source: "CDE Participations",
    },
    {
      fieldCode: "project_census_tract",
      label: "Project Census Tract",
      dataType: "text",
      value: primaryAddress?.censusTract ?? null,
      source: "Project Address",
    },
    {
      fieldCode: "project_city_state",
      label: "Project City / State",
      dataType: "text",
      value: primaryAddress ? `${primaryAddress.city}, ${primaryAddress.stateCode}` : null,
      source: "Project Address",
    },
  ];
}

export async function ensureFieldDefinition(fieldCode: string, label: string, dataType: GoldenField["dataType"]) {
  const existing = await prisma.fieldDefinition.findUnique({ where: { fieldCode_version: { fieldCode, version: 1 } } });
  if (existing) return existing;
  return prisma.fieldDefinition.create({
    data: { fieldCode, version: 1, label, module: "amis", dataType },
  });
}
