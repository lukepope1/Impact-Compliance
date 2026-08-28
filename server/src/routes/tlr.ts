import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";
import { EDITABLE_TLR_OBJECTS, EDITABLE_FIELD_BY_CODE, columnForDataType, PROJECT_NUMBER_FIELD } from "../lib/tlrScope";
import { buildTlrExport } from "../lib/tlrExport";
import { TLR_MAPPING_NAME, TLR_MAPPING_VERSION } from "../lib/tlrFieldCatalog";
import { storage, EVIDENCE_BUCKET } from "../lib/storage";

export const tlrRouter = Router({ mergeParams: true });

/**
 * Entry for the Transaction Level Report a CDE files to AMIS each year.
 *
 * The field list is not written here. It comes from the catalog generated from a real AMIS
 * workbook (src/lib/tlrFieldCatalog.ts) and seeded into FieldDefinition, so all 205 fields
 * are driven by data rather than hand-coded — which is the whole reason the platform's
 * generic field machinery exists instead of another list like lib/goldenFields.ts.
 *
 * Both Impact and the CDE can write. A TLR is the CDE's filing and the CDE holds the loan
 * detail, but Impact does the compliance work on their behalf, so locking either one out
 * would leave the report unfillable by whoever is actually doing the work. QALICBs can
 * read but not write: several of these fields are the CDE's own assertions to the CDFI
 * Fund, not the QALICB's to report.
 */

// A TLR is filed per year, and figures like annual net operating income genuinely differ
// between filings, so values are stored against the reporting year rather than as one
// current state that each year's filing would overwrite.
const yearSchema = z.coerce.number().int().min(2000).max(2100);

function periodFor(year: number) {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) };
}

const WRITE_ROLES = [
  "impact_super_admin",
  "impact_compliance_manager",
  "impact_analyst",
  "cde_admin",
  "cde_reviewer",
] as const;

tlrRouter.get("/", requireDealAccess, async (req, res) => {
  const parsedYear = yearSchema.safeParse(req.query.year ?? new Date().getUTCFullYear());
  if (!parsedYear.success) return res.status(400).json({ error: "Invalid year" });
  const year = parsedYear.data;
  const { end } = periodFor(year);
  const dealId = req.params.dealId;

  const [qlicis, values, disbursements] = await Promise.all([
    prisma.qlici.findMany({
      where: { dealId },
      orderBy: { qliciCode: "asc" },
      select: { id: true, qliciCode: true, qliciType: true, status: true },
    }),
    prisma.structuredValue.findMany({
      where: { dealId, reportingPeriodEnd: end },
      select: {
        qliciId: true,
        valueText: true,
        valueNumber: true,
        valueBoolean: true,
        valueDate: true,
        fieldDefinition: { select: { fieldCode: true } },
      },
    }),
    prisma.disbursement.findMany({
      where: { qlici: { dealId } },
      orderBy: [{ disbursementDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  res.json({
    year,
    objects: EDITABLE_TLR_OBJECTS,
    projectNumberField: PROJECT_NUMBER_FIELD,
    qlicis,
    disbursements: disbursements.map((d) => ({
      ...d,
      sourceAmount: d.sourceAmount === null ? null : Number(d.sourceAmount),
    })),
    values: values.map((v) => ({
      fieldCode: v.fieldDefinition.fieldCode,
      qliciId: v.qliciId,
      value:
        v.valueBoolean ??
        (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null) ??
        (v.valueNumber === null ? null : Number(v.valueNumber)) ??
        v.valueText,
    })),
  });
});

const putValuesSchema = z.object({
  year: yearSchema,
  values: z.array(
    z.object({
      fieldCode: z.string(),
      // null scopes the value to the deal (project and address fields); a QLICI id scopes
      // it to one note.
      qliciId: z.string().uuid().nullable(),
      // null clears the field. Blank and zero are different claims on a TLR, so an empty
      // box removes the row rather than storing a zero the CDE never asserted.
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
  ),
});

tlrRouter.put("/values", requireRoleOnDealOrg(...WRITE_ROLES), async (req, res) => {
  const parsed = putValuesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { year, values } = parsed.data;
  const dealId = req.params.dealId;
  const { start, end } = periodFor(year);

  // A StructuredValue carries dealId as well as qliciId and nothing in the schema can stop
  // those two disagreeing, so confirm every referenced note actually belongs to this deal
  // before writing — otherwise a caller could attach values to another deal's note.
  const referenced = [...new Set(values.map((v) => v.qliciId).filter((id): id is string => id !== null))];
  if (referenced.length > 0) {
    const owned = await prisma.qlici.count({ where: { dealId, id: { in: referenced } } });
    if (owned !== referenced.length) return res.status(400).json({ error: "A QLICI does not belong to this deal" });
  }

  // Resolved in one query rather than per field: the editor saves a whole object at once,
  // which for the project sheet is 114 fields and would otherwise be 114 round trips.
  const definitions = await prisma.fieldDefinition.findMany({
    where: { version: 1, fieldCode: { in: [...new Set(values.map((v) => v.fieldCode))] } },
    select: { id: true, fieldCode: true },
  });
  const definitionByCode = new Map(definitions.map((d) => [d.fieldCode, d.id]));

  const prepared: { fieldDefinitionId: string; qliciId: string | null; data: Record<string, unknown> | null }[] = [];
  for (const v of values) {
    const spec = EDITABLE_FIELD_BY_CODE.get(v.fieldCode);
    if (!spec) return res.status(400).json({ error: `Unknown TLR field: ${v.fieldCode}` });
    if (spec.scope === "qlici" && v.qliciId === null) {
      return res.status(400).json({ error: `${v.fieldCode} is reported per note and needs a QLICI` });
    }
    if (spec.scope === "deal" && v.qliciId !== null) {
      return res.status(400).json({ error: `${v.fieldCode} is reported per deal, not per note` });
    }

    const definitionId = definitionByCode.get(v.fieldCode);
    if (!definitionId) return res.status(500).json({ error: `Field ${v.fieldCode} is not seeded` });

    if (v.value === null || v.value === "") {
      prepared.push({ fieldDefinitionId: definitionId, qliciId: v.qliciId, data: null });
      continue;
    }

    const column = columnForDataType(spec.dataType);
    let typed: unknown = v.value;
    if (column === "valueNumber") {
      typed = Number(v.value);
      if (!Number.isFinite(typed as number)) return res.status(400).json({ error: `${spec.amisFieldName} must be a number` });
    } else if (column === "valueBoolean") {
      typed = v.value === true || v.value === "true";
    } else if (column === "valueDate") {
      typed = new Date(String(v.value));
      if (Number.isNaN((typed as Date).getTime())) return res.status(400).json({ error: `${spec.amisFieldName} must be a date` });
    } else {
      typed = String(v.value);
    }
    prepared.push({ fieldDefinitionId: definitionId, qliciId: v.qliciId, data: { [column]: typed } });
  }

  // StructuredValue has no unique constraint across (deal, qlici, field, period) because
  // the model is built to keep superseded history, so one can't be added without breaking
  // that. The editor writes current state, so each field is replaced: delete then insert,
  // in a transaction so a field is never left with neither row nor value.
  await prisma.$transaction(async (tx) => {
    for (const p of prepared) {
      await tx.structuredValue.deleteMany({
        where: {
          dealId,
          qliciId: p.qliciId,
          fieldDefinitionId: p.fieldDefinitionId,
          reportingPeriodEnd: end,
        },
      });
      if (p.data === null) continue;
      await tx.structuredValue.create({
        data: {
          dealId,
          qliciId: p.qliciId,
          fieldDefinitionId: p.fieldDefinitionId,
          reportingPeriodStart: start,
          reportingPeriodEnd: end,
          enteredById: req.user!.id,
          entryMethod: "manual",
          ...p.data,
        },
      });
    }
  });

  await recordAuditEvent(req, {
    dealId,
    objectType: "tlr_value",
    action: "replace",
    afterData: { year, fieldsWritten: prepared.filter((p) => p.data !== null).length, fieldsCleared: prepared.filter((p) => p.data === null).length },
  });

  res.json({ ok: true, written: prepared.length });
});

const disbursementSchema = z.object({
  qliciId: z.string().uuid(),
  qeiName: z.string().trim().max(120).optional().nullable(),
  disbursementDate: z.string().optional().nullable(),
  sourceAmount: z.number().nonnegative().optional().nullable(),
  isRevolving: z.boolean().optional(),
  amisNumber: z.string().trim().max(120).optional().nullable(),
});

async function assertQliciOnDeal(dealId: string, qliciId: string) {
  return (await prisma.qlici.count({ where: { id: qliciId, dealId } })) === 1;
}

tlrRouter.post("/disbursements", requireRoleOnDealOrg(...WRITE_ROLES), async (req, res) => {
  const parsed = disbursementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!(await assertQliciOnDeal(req.params.dealId, parsed.data.qliciId))) {
    return res.status(400).json({ error: "That QLICI does not belong to this deal" });
  }

  const created = await prisma.disbursement.create({
    data: {
      qliciId: parsed.data.qliciId,
      qeiName: parsed.data.qeiName?.trim() || null,
      disbursementDate: parsed.data.disbursementDate ? new Date(parsed.data.disbursementDate) : null,
      sourceAmount: parsed.data.sourceAmount ?? null,
      isRevolving: parsed.data.isRevolving ?? false,
      amisNumber: parsed.data.amisNumber?.trim() || null,
    },
  });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "disbursement",
    action: "create",
    afterData: { id: created.id, qeiName: created.qeiName, sourceAmount: created.sourceAmount?.toString() ?? null },
  });

  res.status(201).json({ ...created, sourceAmount: created.sourceAmount === null ? null : Number(created.sourceAmount) });
});

tlrRouter.delete("/disbursements/:id", requireRoleOnDealOrg(...WRITE_ROLES), async (req, res) => {
  // Scoped by deal in the delete itself, so an id from another deal deletes nothing rather
  // than being trusted because the caller had rights on some deal.
  const deleted = await prisma.disbursement.deleteMany({
    where: { id: req.params.id, qlici: { dealId: req.params.dealId } },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Disbursement not found on this deal" });

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "disbursement",
    action: "delete",
    beforeData: { id: req.params.id },
  });

  res.json({ ok: true });
});

/**
 * Generates the four-sheet workbook for AMIS upload.
 *
 * Like the CSV export it sits beside, this produces a file a person files manually — it
 * never certifies or submits to AMIS on anyone's behalf. Every emitted cell is recorded in
 * export_field_lineage so "where did this number come from" stays answerable after the
 * fact.
 */
tlrRouter.post("/exports/:year", requireRoleOnDealOrg(...WRITE_ROLES), async (req, res) => {
  const parsedYear = yearSchema.safeParse(req.params.year);
  if (!parsedYear.success) return res.status(400).json({ error: "Invalid year" });
  const year = parsedYear.data;
  const dealId = req.params.dealId;

  const built = await buildTlrExport(dealId, year);
  if (built.blockers.length > 0) {
    return res.status(422).json({ error: "Export blocked", blockers: built.blockers });
  }

  const mappingVersion = await prisma.amisMappingVersion.findFirst({
    where: { mappingName: TLR_MAPPING_NAME, versionCode: TLR_MAPPING_VERSION, transport: "manual_review_xlsx" },
  });
  if (!mappingVersion) return res.status(500).json({ error: "TLR mapping version is not seeded" });

  const checksum = crypto.createHash("sha256").update(built.buffer).digest("hex");
  const fileName = `TLR_${year}_${built.projectNumber ?? "project"}_${Date.now()}.xlsx`;
  const key = `tlr-exports/${dealId}/${fileName}`;
  await storage.put(EVIDENCE_BUCKET, key, built.buffer);

  // Lineage rows join through amis_field_mappings, so only cells with a mapping for this
  // version can be traced. They all should be — the same catalog produced both.
  const mappings = await prisma.amisFieldMapping.findMany({
    where: { mappingVersionId: mappingVersion.id },
    select: { id: true, amisObject: true, amisFieldName: true },
  });
  const mappingId = new Map(mappings.map((m) => [`${m.amisObject}::${m.amisFieldName}`, m.id]));

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.exportBatch.create({
      data: {
        dealId,
        mappingVersionId: mappingVersion.id,
        reportingPeriodEnd: new Date(Date.UTC(year, 11, 31)),
        exportType: "amis_tlr_xlsx",
        status: "ready",
        s3Bucket: EVIDENCE_BUCKET,
        s3ObjectKey: key,
        fileName,
        fileChecksum: checksum,
        validationResults: [],
        generatedById: req.user!.id,
      },
    });

    const lineage = built.cells
      .map((c) => ({ id: mappingId.get(`${c.amisObject}::${c.amisFieldName}`), c }))
      .filter((r): r is { id: string; c: (typeof built.cells)[number] } => Boolean(r.id))
      .map((r) => ({
        exportBatchId: created.id,
        amisFieldMappingId: r.id,
        outputFieldName: r.c.amisFieldName,
        outputValue: r.c.value,
      }));
    if (lineage.length > 0) await tx.exportFieldLineage.createMany({ data: lineage });

    return created;
  });

  await recordAuditEvent(req, {
    dealId,
    objectType: "export_batch",
    objectId: batch.id,
    action: "generate_amis_tlr_xlsx",
    afterData: { fileName, year, sheetRows: built.sheetRows, cells: built.cells.length },
  });

  res.status(201).json({ ...batch, sheetRows: built.sheetRows, cells: built.cells.length });
});

tlrRouter.get("/exports", requireDealAccess, async (req, res) => {
  const exports = await prisma.exportBatch.findMany({
    where: { dealId: req.params.dealId, exportType: "amis_tlr_xlsx" },
    orderBy: { generatedAt: "desc" },
  });
  res.json(exports);
});

tlrRouter.get("/exports/:exportId/download", requireDealAccess, async (req, res) => {
  const batch = await prisma.exportBatch.findFirst({
    where: { id: req.params.exportId, dealId: req.params.dealId, exportType: "amis_tlr_xlsx" },
  });
  if (!batch || !batch.s3ObjectKey) return res.status(404).json({ error: "Export not found" });

  const data = await storage.get(batch.s3Bucket!, batch.s3ObjectKey);
  if (batch.status === "ready") {
    await prisma.exportBatch.update({ where: { id: batch.id }, data: { status: "downloaded" } });
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${batch.fileName}"`);
  res.send(data);
});
