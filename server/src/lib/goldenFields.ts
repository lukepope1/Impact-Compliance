import { prisma } from "./prisma";

/**
 * The small set of cross-CDE / AMIS fields this MVP resolves automatically from deal and
 * CBR data. A real Phase 2+ build would drive this from field_definitions + structured
 * source_preference config per the schema; hardcoding the resolution here keeps Phase 6
 * scoped to proving the snapshot/export mechanics end to end rather than building a full
 * generic field-resolution engine.
 */
export interface GoldenField {
  fieldCode: string;
  label: string;
  dataType: "text" | "integer" | "currency";
  value: string | number | null;
  source: string;
}

export async function resolveGoldenValues(dealId: string, year: number): Promise<GoldenField[]> {
  const [deal, period] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId } }),
    prisma.cbrReportingPeriod.findUnique({
      where: { dealId_calendarYear: { dealId, calendarYear: year } },
      include: { projectProfile: true, jobRecords: true },
    }),
  ]);

  const jobsCreated = period?.jobRecords.filter((j) => j.jobStatus === "created").reduce((sum, j) => sum + Number(j.fteCount), 0) ?? null;

  return [
    {
      fieldCode: "annual_gross_revenue",
      label: "Annual Gross Revenue",
      dataType: "currency",
      value: period?.projectProfile?.annualGrossRevenue ? Number(period.projectProfile.annualGrossRevenue) : null,
      source: "CBR Project Profile",
    },
    {
      fieldCode: "jobs_created_actual",
      label: "Actual Jobs Created",
      dataType: "integer",
      value: period && period.jobRecords.length > 0 ? jobsCreated : null,
      source: "CBR Jobs & Workforce",
    },
    {
      fieldCode: "multi_cde_project_number",
      label: "Multi-CDE Project Number",
      dataType: "text",
      value: deal?.multiCdeProjectNumber ?? null,
      source: "Deal record",
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
