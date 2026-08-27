import { Router } from "express";
import type { ImpactMetric } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AMIS_FIELD_CATEGORY, resolveGoldenValues } from "../lib/goldenFields";

export const portfolioRouter = Router();

const DAY = 86_400_000;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Buckets for the "next 90 days" deadline chart; `key` is what the Review Queue filter reads back. */
const DEADLINE_BUCKETS = [
  { key: "0_30", label: "0–30 days", from: 0, to: 30 },
  { key: "31_60", label: "31–60 days", from: 31, to: 60 },
  { key: "61_90", label: "61–90 days", from: 61, to: 90 },
  { key: "90_plus", label: "90+ days", from: 91, to: Number.POSITIVE_INFINITY },
] as const;

// Instances in these states are finished; they have a due date in the past but nobody
// owes anything, so they must not land in a "what's coming up" chart.
const SETTLED_STATUSES = ["cde_approved", "amis_ready", "exported_filed", "closed", "waived"];

/**
 * One request backing the whole CDE portfolio dashboard. Deliberately server-side: the
 * existing dashboards fan out to 4-5 per-deal calls each and then aggregate in the
 * browser, which at three deals is already 15 round trips and gets worse per deal added.
 *
 * Scoped exactly like GET /deals — deals this user's organizations hold access rows for —
 * so a CDE only ever aggregates its own portfolio.
 */
portfolioRouter.get("/summary", async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const now = new Date();
  const orgIds = req.user!.memberships.map((m) => m.organizationId);

  const deals = await prisma.deal.findMany({
    where: {
      organizationAccess: { some: { organizationId: { in: orgIds } } },
      status: { notIn: ["closed", "archived"] },
    },
    select: { id: true, dealCode: true, legalName: true, status: true },
    orderBy: { legalName: "asc" },
  });
  const dealIds = deals.map((d) => d.id);

  if (dealIds.length === 0) {
    return res.json({
      year,
      deals: [],
      totals: { assignedDeals: 0, originalQliciPrincipal: 0, outstandingComplianceItems: 0 },
      health: { current: 0, dueSoon: 0, overdue: 0, materialIssues: 0 },
      deadlines: DEADLINE_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0 })),
      amis: { ready: 0, incomplete: 0, notStarted: 0, readinessPercent: 0, missingByCategory: [] },
      impact: [],
    });
  }

  const [instances, openIssues, qliciSum, targets, cbrPeriods] = await Promise.all([
    prisma.requirementInstance.findMany({
      where: { dealId: { in: dealIds } },
      select: { dealId: true, dueDate: true, status: true, isOverdue: true },
    }),
    prisma.issue.findMany({
      where: { dealId: { in: dealIds }, status: { notIn: ["resolved", "closed"] } },
      select: { dealId: true, severity: true },
    }),
    prisma.qlici.aggregate({ where: { dealId: { in: dealIds } }, _sum: { originalPrincipal: true } }),
    prisma.impactTarget.findMany({ where: { dealId: { in: dealIds } } }),
    prisma.cbrReportingPeriod.findMany({
      where: { dealId: { in: dealIds }, calendarYear: year },
      include: {
        jobRecords: { select: { fteCount: true, jobStatus: true, accessibleToLicLip: true } },
        serviceOutcomes: { select: { peopleServedCurrent: true, squareFeet: true } },
        tenantOccupants: { select: { squareFeet: true } },
      },
    }),
  ]);

  // ---------- Compliance health, counted per deal ----------
  // Per-deal rather than per-item on purpose: "5 overdue items" doesn't tell a CDE whether
  // that's one struggling QALICB or five, which is the management question.
  const health = { current: 0, dueSoon: 0, overdue: 0, materialIssues: 0 };
  const in30 = new Date(now.getTime() + 30 * DAY);

  const dealRows = deals.map((deal) => {
    const mine = instances.filter((i) => i.dealId === deal.id && !SETTLED_STATUSES.includes(i.status));
    const overdueCount = mine.filter((i) => i.isOverdue).length;
    const dueSoonCount = mine.filter((i) => !i.isOverdue && i.dueDate && i.dueDate >= now && i.dueDate <= in30).length;
    const material = openIssues.filter((i) => i.dealId === deal.id && (i.severity === "high" || i.severity === "critical")).length;

    // Worst-first so the buckets stay mutually exclusive and sum to the deal count.
    const bucket = material > 0 ? "materialIssues" : overdueCount > 0 ? "overdue" : dueSoonCount > 0 ? "dueSoon" : "current";
    health[bucket as keyof typeof health] += 1;

    return { ...deal, overdueCount, dueSoonCount, materialIssueCount: material, healthBucket: bucket };
  });

  // ---------- Upcoming deadlines ----------
  const deadlines = DEADLINE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: instances.filter((i) => {
      if (SETTLED_STATUSES.includes(i.status) || !i.dueDate) return false;
      const days = Math.floor((i.dueDate.getTime() - now.getTime()) / DAY);
      return days >= b.from && days <= b.to;
    }).length,
  }));

  // ---------- AMIS readiness ----------
  const perDealFields = await Promise.all(deals.map((d) => resolveGoldenValues(d.id, year)));
  const missingByCategory = new Map<string, number>();
  let ready = 0;
  let incomplete = 0;
  let notStarted = 0;
  let totalFields = 0;
  let totalReady = 0;

  perDealFields.forEach((fields) => {
    // Same "missing" test amis.ts uses when it builds the readiness table and blocks an
    // export, so the portfolio count can never disagree with the per-deal AMIS screen.
    const missing = fields.filter((f) => f.value === null || f.value === "");
    totalFields += fields.length;
    totalReady += fields.length - missing.length;
    if (missing.length === 0) ready += 1;
    else if (missing.length === fields.length) notStarted += 1;
    else incomplete += 1;

    missing.forEach((f) => {
      const cat = AMIS_FIELD_CATEGORY[f.fieldCode] ?? "Other";
      missingByCategory.set(cat, (missingByCategory.get(cat) ?? 0) + 1);
    });
  });

  // ---------- Community impact: committed vs actual ----------
  // Only deals that actually committed to a measure contribute to *either* side of it.
  // Summing every deal's actual against only the committing deals' totals would inflate
  // achievement with impact nobody promised.
  const actualsByDeal = new Map<string, Record<ImpactMetric, number>>();
  for (const period of cbrPeriods) {
    const jobs = period.jobRecords;
    actualsByDeal.set(period.dealId, {
      permanent_jobs: jobs.filter((j) => j.jobStatus === "created").reduce((s, j) => s + num(j.fteCount), 0),
      retained_jobs: jobs.filter((j) => j.jobStatus === "retained").reduce((s, j) => s + num(j.fteCount), 0),
      construction_jobs: jobs.filter((j) => j.jobStatus === "construction").reduce((s, j) => s + num(j.fteCount), 0),
      lmi_jobs: jobs.filter((j) => j.accessibleToLicLip).reduce((s, j) => s + num(j.fteCount), 0),
      people_served: period.serviceOutcomes.reduce((s, o) => s + num(o.peopleServedCurrent), 0),
      square_feet:
        period.serviceOutcomes.reduce((s, o) => s + num(o.squareFeet), 0) +
        period.tenantOccupants.reduce((s, t) => s + num(t.squareFeet), 0),
    });
  }

  const metrics = [...new Set(targets.map((t) => t.metric))];
  const impact = metrics.map((metric) => {
    const forMetric = targets.filter((t) => t.metric === metric);
    const committed = forMetric.reduce((s, t) => s + num(t.committedValue), 0);
    const actual = forMetric.reduce((s, t) => s + (actualsByDeal.get(t.dealId)?.[metric] ?? 0), 0);
    return {
      metric,
      committed,
      actual,
      achievementPercent: committed > 0 ? Math.round((actual / committed) * 100) : null,
      dealsCommitted: forMetric.length,
    };
  });

  res.json({
    year,
    deals: dealRows,
    totals: {
      assignedDeals: deals.length,
      originalQliciPrincipal: num(qliciSum._sum.originalPrincipal),
      outstandingComplianceItems: instances.filter((i) => !SETTLED_STATUSES.includes(i.status) && (i.isOverdue || i.status === "returned")).length,
    },
    health,
    deadlines,
    amis: {
      ready,
      incomplete,
      notStarted,
      readinessPercent: totalFields > 0 ? Math.round((totalReady / totalFields) * 100) : 0,
      missingByCategory: [...missingByCategory.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    },
    impact,
  });
});
