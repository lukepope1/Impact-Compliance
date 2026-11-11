import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireDealAccess } from "../middleware/auth";
import { resolveGoldenValues } from "../lib/goldenFields";
import { storage } from "../lib/storage";

export const amisRouter = Router({ mergeParams: true });

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

/** Every export a deal has produced, of any type — the TLR workbooks and the older CSVs alike. */
amisRouter.get("/exports", requireDealAccess, async (req, res) => {
  const exports = await prisma.exportBatch.findMany({
    where: { dealId: req.params.dealId },
    orderBy: { generatedAt: "desc" },
  });
  res.json(exports);
});

/**
 * Downloads a legacy CSV export.
 *
 * Nothing generates these any more: the three-column "AMIS Field, Value, Source" CSV was a
 * readiness summary rather than a filing, and the TLR workbook (routes/tlr.ts) replaced it.
 * The download stays so batches generated before the switch remain retrievable — an export
 * is a record of what was produced, and deleting the route would orphan that history.
 */
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
