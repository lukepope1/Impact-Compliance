import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRole, requireRoleOnDealOrg } from "../middleware/auth";

export const dealsRouter = Router();

/** Deals visible to the current user, across every organization they belong to. */
dealsRouter.get("/", async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const deals = await prisma.deal.findMany({
    where: { organizationAccess: { some: { organizationId: { in: orgIds } } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(deals);
});

dealsRouter.get("/:dealId", requireDealAccess, async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: {
      parties: true,
      cdeParticipations: { include: { cdeOrganization: true } },
      projectAddresses: true,
    },
  });
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  res.json(deal);
});

const createDealSchema = z.object({
  dealCode: z.string().min(1),
  legalName: z.string().min(1),
  projectName: z.string().optional(),
  closingDate: z.coerce.date().optional(),
  complianceStartDate: z.coerce.date().optional(),
  complianceEndDate: z.coerce.date().optional(),
  isMultiCde: z.boolean().default(false),
});

/** Impact Marketplace staff only — the QALICB/CDE portals never create deals. */
dealsRouter.post("/", requireRole("impact_super_admin", "impact_compliance_manager"), async (req, res) => {
  const parsed = createDealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const deal = await prisma.deal.create({
    data: { ...parsed.data, createdById: req.user!.id },
  });

  await recordAuditEvent(req, { dealId: deal.id, objectType: "deal", objectId: deal.id, action: "create", afterData: deal });
  res.status(201).json(deal);
});

const DEAL_STATUSES = ["onboarding", "active", "exception", "winding_down", "closed", "archived"] as const;
type DealStatus = (typeof DEAL_STATUSES)[number];

/**
 * The deal lifecycle this build enforces — not every status-to-status jump makes sense
 * (going straight from "onboarding" to "archived" would skip actually running the deal).
 * "closed" only reachable via "winding_down", and "archived" only from "closed" — a deal
 * has to actually wind down and close before it can be archived. "archived" is terminal:
 * once archived, a deal is excluded from the deadline sweep (see deadlineSweep.ts's
 * `status: { notIn: ["closed", "archived"] }` filter) and this build has no "un-archive"
 * path, matching what "archival" is supposed to mean.
 */
const ALLOWED_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  onboarding: ["active"],
  active: ["exception", "winding_down"],
  exception: ["active", "winding_down"],
  winding_down: ["active", "closed"],
  closed: ["winding_down", "archived"],
  archived: [],
};

// closed/archived meaningfully change what the deal shows up in (reporting, the deadline
// sweep) — worth requiring a human-readable reason in the audit trail, the same way
// returning or waiving a requirement already requires a note elsewhere in this app.
const REASON_REQUIRED_FOR: DealStatus[] = ["closed", "archived"];

const updateDealSchema = createDealSchema.partial().extend({
  status: z.enum(DEAL_STATUSES).optional(),
  multiCdeProjectNumber: z.string().optional(),
  statusChangeReason: z.string().optional(),
});

dealsRouter.patch(
  "/:dealId",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const parsed = updateDealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const before = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
    if (!before) return res.status(404).json({ error: "Deal not found" });

    const { statusChangeReason, ...data } = parsed.data;

    if (data.status && data.status !== before.status) {
      if (!ALLOWED_TRANSITIONS[before.status].includes(data.status)) {
        return res.status(409).json({
          error: `Cannot move a deal from "${before.status}" to "${data.status}" — allowed next statuses: ${
            ALLOWED_TRANSITIONS[before.status].join(", ") || "none, this status is terminal"
          }`,
        });
      }
      if (REASON_REQUIRED_FOR.includes(data.status) && !statusChangeReason?.trim()) {
        return res.status(400).json({ error: `A reason is required to move a deal to "${data.status}"` });
      }
    }

    const deal = await prisma.deal.update({ where: { id: req.params.dealId }, data });

    await recordAuditEvent(req, {
      dealId: deal.id,
      objectType: "deal",
      objectId: deal.id,
      action: "update",
      beforeData: before,
      afterData: statusChangeReason ? { ...deal, statusChangeReason } : deal,
    });
    res.json(deal);
  }
);
