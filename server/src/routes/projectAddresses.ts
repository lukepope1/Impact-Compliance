import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";

export const projectAddressesRouter = Router({ mergeParams: true });

projectAddressesRouter.get("/", requireDealAccess, async (req, res) => {
  const addresses = await prisma.projectAddress.findMany({ where: { dealId: req.params.dealId }, orderBy: { createdAt: "asc" } });
  res.json(addresses);
});

const addressSchema = z.object({
  addressType: z.enum(["primary", "secondary", "service_area", "other"]).default("primary"),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  stateCode: z.string().length(2),
  postalCode: z.string().min(1),
  postalCodePlus4: z.string().optional(),
  county: z.string().optional(),
  censusTract: z.string().optional(),
});

/**
 * There's exactly one "primary" address per deal by convention (goldenFields.ts picks the
 * first one with addressType "primary", falling back to the first address at all) — so a
 * PUT here upserts that one record rather than requiring the caller to already know its id.
 * Other address types (secondary/service_area/other) aren't editable through this endpoint
 * yet since nothing in the app reads them.
 */
projectAddressesRouter.put("/primary", requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"), async (req, res) => {
  const parsed = addressSchema.safeParse({ ...req.body, addressType: "primary" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.projectAddress.findFirst({ where: { dealId: req.params.dealId, addressType: "primary" } });

  const address = existing
    ? await prisma.projectAddress.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.projectAddress.create({ data: { dealId: req.params.dealId, ...parsed.data } });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "project_address",
    objectId: address.id,
    action: existing ? "update" : "create",
    beforeData: existing ?? undefined,
    afterData: address,
  });

  res.json(address);
});
