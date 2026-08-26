import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";
import { resolveGoldenValues, ensureFieldDefinition } from "../lib/goldenFields";
import { storage, EVIDENCE_BUCKET } from "../lib/storage";

export const amisRouter = Router({ mergeParams: true });

const MAPPING_NAME = "amis_review_export";
const MAPPING_VERSION_CODE = "2026-06";

async function ensureMappingVersion() {
  const existing = await prisma.amisMappingVersion.findFirst({
    where: { mappingName: MAPPING_NAME, versionCode: MAPPING_VERSION_CODE, transport: "csv" },
  });
  if (existing) return existing;
  return prisma.amisMappingVersion.create({
    data: { mappingName: MAPPING_NAME, versionCode: MAPPING_VERSION_CODE, transport: "csv", status: "active" },
  });
}

/**
 * AMIS readiness (C-08): resolves each of the small set of golden fields this MVP
 * supports (see goldenFields.ts) and reports ready/missing so a gap is visible before
 * export is attempted, rather than failing silently in the generated file.
 */
amisRouter.get("/readiness/:year", requireDealAccess, async (req, res) => {
  const golden = await resolveGoldenValues(req.params.dealId, Number(req.params.year));
  res.json(
    golden.map((g) => ({
      fieldCode: g.fieldCode,
      label: g.label,
      value: g.value,
      source: g.source,
      status: g.value === null || g.value === "" ? "missing" : "ready",
    }))
  );
});

amisRouter.get("/exports", requireDealAccess, async (req, res) => {
  const exports = await prisma.exportBatch.findMany({
    where: { dealId: req.params.dealId },
    orderBy: { generatedAt: "desc" },
  });
  res.json(exports);
});

/**
 * Generates a controlled CSV review file — Phase 1's stated boundary: this never
 * auto-certifies or submits to AMIS, it only produces the file a human files manually.
 * Blocked while any golden field is missing, and every output cell is traced back to its
 * source in export_field_lineage so "where did this number come from" is always answerable.
 */
amisRouter.post(
  "/exports/:year",
  // requireRoleOnDealOrg confirms the specific org backing the matched role actually
  // has access to this deal — without it, an unrelated CDE's cde_admin could pull
  // another deal's financial export just by holding the role somewhere.
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager", "cde_admin"),
  async (req, res) => {
    const year = Number(req.params.year);
    const golden = await resolveGoldenValues(req.params.dealId, year);
    const missing = golden.filter((g) => g.value === null || g.value === "");
    if (missing.length > 0) {
      return res.status(422).json({ error: "Export blocked — missing fields", missing: missing.map((m) => m.fieldCode) });
    }

    const mappingVersion = await ensureMappingVersion();
    const fieldMappings = await Promise.all(
      golden.map(async (g) => {
        const fieldDefinition = await ensureFieldDefinition(g.fieldCode, g.label, g.dataType);
        const existing = await prisma.amisFieldMapping.findFirst({
          where: { mappingVersionId: mappingVersion.id, amisObject: "Project", amisFieldName: g.label },
        });
        if (existing) return { mapping: existing, golden: g, fieldDefinition };
        const created = await prisma.amisFieldMapping.create({
          data: {
            mappingVersionId: mappingVersion.id,
            internalFieldCode: g.fieldCode,
            fieldDefinitionId: fieldDefinition.id,
            amisObject: "Project",
            amisFieldName: g.label,
          },
        });
        return { mapping: created, golden: g, fieldDefinition };
      })
    );

    const csvLines = ["AMIS Field,Value,Source", ...fieldMappings.map((f) => `"${f.golden.label}","${f.golden.value}","${f.golden.source}"`)];
    const csvContent = Buffer.from(csvLines.join("\n"), "utf-8");
    const checksum = crypto.createHash("sha256").update(csvContent).digest("hex");
    const fileName = `AMIS_${year}_${Date.now()}.csv`;
    const key = `amis-exports/${req.params.dealId}/${fileName}`;
    await storage.put(EVIDENCE_BUCKET, key, csvContent);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.exportBatch.create({
        data: {
          dealId: req.params.dealId,
          mappingVersionId: mappingVersion.id,
          reportingPeriodEnd: new Date(Date.UTC(year, 11, 31)),
          exportType: "amis_csv",
          status: "ready",
          s3Bucket: EVIDENCE_BUCKET,
          s3ObjectKey: key,
          fileName,
          fileChecksum: checksum,
          validationResults: [],
          generatedById: req.user!.id,
        },
      });

      await tx.exportFieldLineage.createMany({
        data: fieldMappings.map((f) => ({
          exportBatchId: created.id,
          amisFieldMappingId: f.mapping.id,
          outputFieldName: f.golden.label,
          outputValue: String(f.golden.value),
        })),
      });

      return created;
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "export_batch",
      objectId: batch.id,
      action: "generate_amis_csv",
      afterData: { fileName, fieldCount: fieldMappings.length },
    });

    res.status(201).json(batch);
  }
);

amisRouter.get("/exports/:exportId/download", requireDealAccess, async (req, res) => {
  const batch = await prisma.exportBatch.findUnique({ where: { id: req.params.exportId } });
  if (!batch || batch.dealId !== req.params.dealId || !batch.s3ObjectKey) return res.status(404).json({ error: "Export not found" });

  const data = await storage.get(batch.s3Bucket!, batch.s3ObjectKey);
  if (batch.status === "ready") {
    await prisma.exportBatch.update({ where: { id: batch.id }, data: { status: "downloaded" } });
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${batch.fileName}"`);
  res.send(data);
});
