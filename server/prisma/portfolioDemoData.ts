import type { PrismaClient } from "@prisma/client";

/**
 * Fills out the CDE portfolio so the portfolio dashboard has something real to aggregate.
 *
 * The base seed gives Millennium Holdings QLICIs and a year of CBR data but leaves
 * Riverside and Harbor empty, which left every portfolio roll-up reading as a single
 * deal's numbers plus two columns of zeros. These are invented demo figures — plausible
 * for a manufacturing expansion and a health clinic, not drawn from any real deal — but
 * they exercise the aggregation honestly, including deliberately mixed performance so the
 * achievement column shows both over- and under-delivery rather than a wall of 100%.
 *
 * Idempotent: every write is an upsert or is guarded by an existence check, so this can
 * run against an already-seeded database (which is how it was first applied) as well as
 * from a clean `npm run seed`.
 */

interface JobSpec {
  jobTitle: string;
  fteCount: number;
  jobStatus: "created" | "retained" | "construction";
  accessibleToLicLip?: boolean;
}

interface ServiceSpec {
  serviceName: string;
  serviceType?: string;
  peopleServedCurrent?: number;
  squareFeet?: number;
  outcomeNarrative?: string;
}

interface DealDemoSpec {
  dealCode: string;
  qlici?: { code: string; noteClass: string; originalPrincipal: number };
  jobs: JobSpec[];
  services: ServiceSpec[];
  /** Only the metrics this deal actually committed to — a deal needn't commit to every measure. */
  targets: Partial<Record<"permanent_jobs" | "retained_jobs" | "construction_jobs" | "lmi_jobs" | "people_served" | "square_feet", number>>;
  targetSource: string;
}

const SPECS: DealDemoSpec[] = [
  {
    dealCode: "RIVER-2025",
    qlici: { code: "RIVER-QLICI-A", noteClass: "A", originalPrincipal: 8_500_000 },
    jobs: [
      { jobTitle: "Production Operator", fteCount: 34, jobStatus: "created", accessibleToLicLip: true },
      { jobTitle: "Maintenance Technician", fteCount: 6, jobStatus: "created", accessibleToLicLip: true },
      { jobTitle: "Shift Supervisor", fteCount: 4, jobStatus: "created" },
      { jobTitle: "Quality Inspector", fteCount: 3, jobStatus: "created" },
      { jobTitle: "Logistics Coordinator", fteCount: 2, jobStatus: "created" },
      { jobTitle: "Assembly Line (retained)", fteCount: 22, jobStatus: "retained" },
      { jobTitle: "Construction Crew", fteCount: 61, jobStatus: "construction" },
    ],
    services: [
      {
        serviceName: "Operator apprenticeship program",
        serviceType: "workforce training",
        peopleServedCurrent: 180,
        squareFeet: 120_000,
        outcomeNarrative: "Paid apprenticeship pipeline run with the county workforce board.",
      },
    ],
    // Actuals land at: permanent 49, retained 22, construction 61, LIC-accessible 40.
    targets: { permanent_jobs: 55, retained_jobs: 25, construction_jobs: 70, lmi_jobs: 45, people_served: 150, square_feet: 120_000 },
    targetSource: "Allocation agreement §4.2 (community benefits schedule)",
  },
  {
    dealCode: "HARBOR-2026",
    qlici: { code: "HARBOR-QLICI-A", noteClass: "A", originalPrincipal: 6_200_000 },
    jobs: [
      { jobTitle: "Registered Nurse", fteCount: 12, jobStatus: "created" },
      { jobTitle: "Medical Assistant", fteCount: 9, jobStatus: "created", accessibleToLicLip: true },
      { jobTitle: "Front Desk Coordinator", fteCount: 5, jobStatus: "created", accessibleToLicLip: true },
      { jobTitle: "Behavioral Health Counselor", fteCount: 4, jobStatus: "created" },
      { jobTitle: "Clinic Administrator (retained)", fteCount: 3, jobStatus: "retained" },
      { jobTitle: "Build-out Crew", fteCount: 48, jobStatus: "construction" },
    ],
    services: [
      { serviceName: "Primary care visits", serviceType: "community facility", peopleServedCurrent: 14_800, squareFeet: 34_000 },
      { serviceName: "Behavioral health services", serviceType: "community facility", peopleServedCurrent: 3_100 },
    ],
    // Actuals land at: permanent 30, retained 3, construction 48, LIC-accessible 14, served 17,900.
    targets: { permanent_jobs: 34, retained_jobs: 4, construction_jobs: 55, lmi_jobs: 16, people_served: 16_000, square_feet: 34_000 },
    targetSource: "Allocation agreement §4.2 (community benefits schedule)",
  },
  {
    // Millennium already has real seeded CBR actuals (65 created / 18 retained / 1
    // construction / 150 served), so this only adds the commitments to measure them
    // against. No LIC/LIP or square-feet target: its seeded job and service records carry
    // neither, and committing to a measure the deal never reports would show a permanent
    // 0% rather than an honest gap.
    dealCode: "MILL-2025",
    jobs: [],
    services: [],
    targets: { permanent_jobs: 70, retained_jobs: 20, construction_jobs: 4, people_served: 175 },
    targetSource: "QLICI loan agreement §7.3 (projected community impact)",
  },
];

export async function seedPortfolioDemoData(prisma: PrismaClient, year = 2026) {
  const summary: string[] = [];

  for (const spec of SPECS) {
    const deal = await prisma.deal.findFirst({ where: { dealCode: spec.dealCode } });
    if (!deal) {
      summary.push(`${spec.dealCode}: not found, skipped`);
      continue;
    }

    if (spec.qlici) {
      const participation = await prisma.cdeParticipation.findFirst({ where: { dealId: deal.id } });
      if (participation) {
        await prisma.qlici.upsert({
          where: {
            dealId_cdeParticipationId_qliciCode: {
              dealId: deal.id,
              cdeParticipationId: participation.id,
              qliciCode: spec.qlici.code,
            },
          },
          create: {
            dealId: deal.id,
            cdeParticipationId: participation.id,
            qliciCode: spec.qlici.code,
            qliciType: "loan",
            noteClass: spec.qlici.noteClass,
            originalPrincipal: spec.qlici.originalPrincipal,
            currentPrincipal: spec.qlici.originalPrincipal,
            status: "active",
          },
          update: {},
        });
      }
    }

    if (spec.jobs.length > 0 || spec.services.length > 0) {
      const period = await prisma.cbrReportingPeriod.upsert({
        where: { dealId_calendarYear: { dealId: deal.id, calendarYear: year } },
        create: {
          dealId: deal.id,
          calendarYear: year,
          periodStart: new Date(Date.UTC(year, 0, 1)),
          periodEnd: new Date(Date.UTC(year, 11, 31)),
        },
        update: {},
      });

      // Job/service rows have no natural unique key, so guard on "has this period already
      // been populated" rather than risking a duplicate set on a second run.
      const existingJobs = await prisma.jobRecord.count({ where: { cbrPeriodId: period.id } });
      if (existingJobs === 0 && spec.jobs.length > 0) {
        await prisma.jobRecord.createMany({
          data: spec.jobs.map((j) => ({
            cbrPeriodId: period.id,
            jobTitle: j.jobTitle,
            fteCount: j.fteCount,
            jobStatus: j.jobStatus,
            accessibleToLicLip: j.accessibleToLicLip ?? null,
          })),
        });
      }

      const existingServices = await prisma.serviceOutcome.count({ where: { cbrPeriodId: period.id } });
      if (existingServices === 0 && spec.services.length > 0) {
        await prisma.serviceOutcome.createMany({
          data: spec.services.map((s) => ({
            cbrPeriodId: period.id,
            serviceName: s.serviceName,
            serviceType: s.serviceType ?? null,
            peopleServedCurrent: s.peopleServedCurrent ?? null,
            squareFeet: s.squareFeet ?? null,
            outcomeNarrative: s.outcomeNarrative ?? null,
          })),
        });
      }
    }

    for (const [metric, committed] of Object.entries(spec.targets)) {
      await prisma.impactTarget.upsert({
        where: { dealId_metric: { dealId: deal.id, metric: metric as never } },
        create: {
          dealId: deal.id,
          metric: metric as never,
          committedValue: committed,
          sourceNote: spec.targetSource,
        },
        update: { committedValue: committed, sourceNote: spec.targetSource },
      });
    }

    summary.push(`${spec.dealCode}: ${spec.jobs.length} jobs, ${spec.services.length} services, ${Object.keys(spec.targets).length} targets`);
  }

  return summary;
}
