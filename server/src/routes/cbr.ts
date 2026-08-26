import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole } from "../middleware/auth";

export const cbrRouter = Router({ mergeParams: true });

const EDITOR_ROLES = [
  "impact_super_admin",
  "impact_compliance_manager",
  "impact_analyst",
  "qalicb_admin",
  "qalicb_contributor",
] as const;

async function getOrCreatePeriod(dealId: string, calendarYear: number) {
  const existing = await prisma.cbrReportingPeriod.findUnique({ where: { dealId_calendarYear: { dealId, calendarYear } } });
  if (existing) return existing;
  return prisma.cbrReportingPeriod.create({
    data: {
      dealId,
      calendarYear,
      periodStart: new Date(Date.UTC(calendarYear, 0, 1)),
      periodEnd: new Date(Date.UTC(calendarYear, 11, 31)),
    },
  });
}

cbrRouter.get("/:year", requireDealAccess, async (req, res) => {
  const period = await getOrCreatePeriod(req.params.dealId, Number(req.params.year));
  const full = await prisma.cbrReportingPeriod.findUnique({
    where: { id: period.id },
    include: {
      projectProfile: true,
      jobRecords: { orderBy: { createdAt: "asc" } },
      benefitRecords: true,
      tenantOccupants: { orderBy: { createdAt: "asc" } },
      serviceOutcomes: { orderBy: { createdAt: "asc" } },
    },
  });
  res.json(full);
});

const profileSchema = z.object({
  projectDescription: z.string().optional(),
  butForStatement: z.string().optional(),
  licBenefitDescription: z.string().optional(),
  annualGrossRevenue: z.number().optional(),
  annualNetOperatingIncome: z.number().optional(),
});

cbrRouter.put("/:year/profile", requireDealAccess, requireRole(...EDITOR_ROLES), async (req, res) => {
  const period = await getOrCreatePeriod(req.params.dealId, Number(req.params.year));
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const profile = await prisma.cbrProjectProfile.upsert({
    where: { cbrPeriodId: period.id },
    create: { cbrPeriodId: period.id, ...parsed.data },
    update: parsed.data,
  });

  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "cbr_project_profile", objectId: profile.id, action: "upsert", afterData: profile });
  res.json(profile);
});

const jobSchema = z.object({
  jobTitle: z.string().min(1),
  fteCount: z.number().nonnegative(),
  jobStatus: z.enum(["retained", "created", "construction"]).optional(),
  hourlyWage: z.number().optional(),
  accessibleToLicLip: z.boolean().optional(),
});

cbrRouter.post("/:year/jobs", requireDealAccess, requireRole(...EDITOR_ROLES), async (req, res) => {
  const period = await getOrCreatePeriod(req.params.dealId, Number(req.params.year));
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.jobRecord.create({ data: { cbrPeriodId: period.id, ...parsed.data } });
  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "job_record", objectId: job.id, action: "create", afterData: job });
  res.status(201).json(job);
});

const tenantSchema = z.object({
  organizationName: z.string().min(1),
  organizationType: z.string().optional(),
  purposeGoodsServices: z.string().optional(),
  squareFeet: z.number().optional(),
  currentEmployees: z.number().optional(),
});

cbrRouter.post("/:year/tenants", requireDealAccess, requireRole(...EDITOR_ROLES), async (req, res) => {
  const period = await getOrCreatePeriod(req.params.dealId, Number(req.params.year));
  const parsed = tenantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tenant = await prisma.tenantOccupant.create({ data: { cbrPeriodId: period.id, ...parsed.data } });
  await recordAuditEvent(req, { dealId: req.params.dealId, objectType: "tenant_occupant", objectId: tenant.id, action: "create", afterData: tenant });
  res.status(201).json(tenant);
});

const benefitSchema = z.object({
  employeeClass: z.enum(["permanent", "temporary", "construction", "other"]),
  benefitCode: z.string().min(1),
  isOffered: z.boolean().optional(),
  percentReceiving: z.number().optional(),
});

/**
 * Benefit rows are keyed by (period, employer, class, code) — find-then-create/update
 * rather than upsert(), since employer_party_id is nullable here and Prisma's compound-
 * unique where input rejects null (see the same pattern in requirementInstances.ts).
 */
cbrRouter.put("/:year/benefits", requireDealAccess, requireRole(...EDITOR_ROLES), async (req, res) => {
  const period = await getOrCreatePeriod(req.params.dealId, Number(req.params.year));
  const parsed = benefitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.benefitRecord.findFirst({
    where: { cbrPeriodId: period.id, employerPartyId: null, employeeClass: parsed.data.employeeClass, benefitCode: parsed.data.benefitCode },
  });

  const benefit = existing
    ? await prisma.benefitRecord.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.benefitRecord.create({ data: { cbrPeriodId: period.id, ...parsed.data } });

  res.json(benefit);
});
