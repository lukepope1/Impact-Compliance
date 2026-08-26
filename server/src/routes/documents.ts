import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { storage, EVIDENCE_BUCKET, sanitizeFileName } from "../lib/storage";
import { scanner, type ScanResult } from "../lib/scanner";
import { canAccessDocument, orgTypeMap } from "../lib/documentAccess";
import { requireDealAccess, requireRoleOnDealOrg } from "../middleware/auth";

export const documentsRouter = Router({ mergeParams: true });

// 25MB cap — plenty for the financial statements / rent rolls this platform handles;
// tighten or raise per document_type later if a category needs more.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/**
 * Scans a buffer and returns the malware_scan_status to store. No scanner configured ->
 * stays "pending" (never silently "clean") — see the fail-closed rationale in scanner.ts.
 */
async function scanUpload(buffer: Buffer): Promise<{ status: ScanResult | "pending"; detail?: string }> {
  if (!scanner) return { status: "pending" };
  const { result, detail } = await scanner.scan(buffer);
  return { status: result, detail };
}

/** An infected upload becomes a critical, deal-visible issue — it shouldn't just sit quietly as a blocked download. */
async function flagInfectedUpload(
  dealId: string,
  documentTitle: string,
  detail: string | undefined,
  assignedToOrganizationId: string | undefined
) {
  await prisma.issue.create({
    data: {
      dealId,
      issueType: "security",
      severity: "critical",
      title: `Malware scan flagged an upload: ${documentTitle}`,
      description: detail ?? "clamd reported this file as infected.",
      assignedToOrganizationId,
    },
  });
}

documentsRouter.get("/", requireDealAccess, async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const types = await orgTypeMap(orgIds);

  const docs = await prisma.document.findMany({
    where: { dealId: req.params.dealId, status: { not: "deleted" } },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const visible = [];
  for (const doc of docs) {
    if (await canAccessDocument(doc, orgIds, types)) visible.push(doc);
  }
  res.json(visible);
});

/** Full version history for one document — the list endpoint above only returns the latest version to stay light. */
documentsRouter.get("/:documentId", requireDealAccess, async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const doc = await prisma.document.findUnique({
    where: { id: req.params.documentId },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!doc || doc.dealId !== req.params.dealId) return res.status(404).json({ error: "Document not found" });

  const types = await orgTypeMap(orgIds);
  if (!(await canAccessDocument(doc, orgIds, types))) {
    return res.status(403).json({ error: "Not authorized to view this document" });
  }

  res.json(doc);
});

/**
 * Uploads the first version of a new document. The file is scanned before the DB row is
 * ever created (see scanUpload) — status is "clean"/"infected"/"failed" if a scanner is
 * configured, or stays "pending" if not. Either way the document exists and is visible
 * (an infected/pending file isn't hidden, just undownloadable — see the /download route's
 * status check), so a scan finding is something reviewers can see and act on, not silence.
 */
documentsRouter.post(
  "/",
  requireRoleOnDealOrg(
    "impact_super_admin",
    "impact_compliance_manager",
    "impact_analyst",
    "qalicb_admin",
    "qalicb_contributor"
  ),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { documentType, title, reportingPeriodStart, reportingPeriodEnd, shareScope, legalEntityPartyId } = req.body;
    if (!documentType || !title) return res.status(400).json({ error: "documentType and title are required" });

    const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const safeFileName = sanitizeFileName(req.file.originalname);
    const key = `${req.params.dealId}/${crypto.randomUUID()}/v1/${safeFileName}`;
    await storage.put(EVIDENCE_BUCKET, key, req.file.buffer);

    const { status: scanStatus, detail: scanDetail } = await scanUpload(req.file.buffer);
    const ownerOrgId = req.user!.memberships[0]?.organizationId;

    const doc = await prisma.document.create({
      data: {
        dealId: req.params.dealId,
        ownerOrganizationId: ownerOrgId,
        documentType,
        title,
        legalEntityPartyId: legalEntityPartyId || undefined,
        reportingPeriodStart: reportingPeriodStart ? new Date(reportingPeriodStart) : undefined,
        reportingPeriodEnd: reportingPeriodEnd ? new Date(reportingPeriodEnd) : undefined,
        shareScope: (shareScope as never) || "impact_only",
        currentVersion: 1,
        createdById: req.user!.id,
        versions: {
          create: {
            versionNumber: 1,
            s3Bucket: EVIDENCE_BUCKET,
            s3ObjectKey: key,
            fileName: safeFileName,
            mimeType: req.file.mimetype,
            fileSizeBytes: BigInt(req.file.size),
            sha256Checksum: checksum,
            malwareScanStatus: scanStatus,
            uploadedById: req.user!.id,
          },
        },
      },
      include: { versions: true },
    });

    if (scanStatus === "infected") {
      await flagInfectedUpload(req.params.dealId, title, scanDetail, ownerOrgId);
    }

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document",
      objectId: doc.id,
      action: "upload",
      afterData: { title: doc.title, documentType: doc.documentType, checksum, scanStatus },
    });

    res.status(201).json(doc);
  }
);

/**
 * Uploads a new version of an existing document. Evidence is never overwritten — this
 * always creates a new document_versions row/object and marks the prior one superseded.
 */
documentsRouter.post(
  "/:documentId/versions",
  requireRoleOnDealOrg(
    "impact_super_admin",
    "impact_compliance_manager",
    "impact_analyst",
    "qalicb_admin",
    "qalicb_contributor"
  ),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
    if (!doc || doc.dealId !== req.params.dealId) return res.status(404).json({ error: "Document not found" });

    const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const nextVersion = doc.currentVersion + 1;
    const safeFileName = sanitizeFileName(req.file.originalname);
    const key = `${req.params.dealId}/${doc.id}/v${nextVersion}/${safeFileName}`;
    await storage.put(EVIDENCE_BUCKET, key, req.file.buffer);

    const { status: scanStatus, detail: scanDetail } = await scanUpload(req.file.buffer);

    const [, version] = await prisma.$transaction([
      prisma.documentVersion.updateMany({
        where: { documentId: doc.id, versionNumber: doc.currentVersion },
        data: { supersededAt: new Date() },
      }),
      prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: nextVersion,
          s3Bucket: EVIDENCE_BUCKET,
          s3ObjectKey: key,
          fileName: safeFileName,
          mimeType: req.file.mimetype,
          fileSizeBytes: BigInt(req.file.size),
          sha256Checksum: checksum,
          malwareScanStatus: scanStatus,
          uploadedById: req.user!.id,
        },
      }),
      prisma.document.update({ where: { id: doc.id }, data: { currentVersion: nextVersion } }),
    ]);

    if (scanStatus === "infected") {
      await flagInfectedUpload(req.params.dealId, doc.title, scanDetail, doc.ownerOrganizationId ?? undefined);
    }

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document_version",
      objectId: version.id,
      action: "upload_new_version",
      afterData: { documentId: doc.id, versionNumber: nextVersion, checksum, scanStatus },
    });

    res.status(201).json(version);
  }
);

/**
 * Re-runs the scan on a version stuck at "pending" (scanner was unset/unreachable at
 * upload time) or "failed" (a transient clamd error). Never re-scans an already "clean"
 * or "infected" version — a scan result on stored evidence shouldn't flip without an
 * explicit reason to distrust the first one.
 */
documentsRouter.post(
  "/:documentId/versions/:versionId/rescan",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
    if (!doc || doc.dealId !== req.params.dealId) return res.status(404).json({ error: "Document not found" });

    const version = await prisma.documentVersion.findUnique({ where: { id: req.params.versionId } });
    if (!version || version.documentId !== doc.id) return res.status(404).json({ error: "Version not found" });
    if (version.malwareScanStatus === "clean" || version.malwareScanStatus === "infected") {
      return res.status(409).json({ error: `Version is already "${version.malwareScanStatus}" — not re-scanning a settled result` });
    }

    const data = await storage.get(version.s3Bucket, version.s3ObjectKey);
    const { status: scanStatus, detail: scanDetail } = await scanUpload(data);

    const updated = await prisma.documentVersion.update({
      where: { id: version.id },
      data: { malwareScanStatus: scanStatus },
    });

    if (scanStatus === "infected") {
      await flagInfectedUpload(req.params.dealId, doc.title, scanDetail, doc.ownerOrganizationId ?? undefined);
    }

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document_version",
      objectId: version.id,
      action: "rescan",
      beforeData: { malwareScanStatus: version.malwareScanStatus },
      afterData: { malwareScanStatus: scanStatus },
    });

    res.json(updated);
  }
);

documentsRouter.get("/:documentId/versions/:versionId/download", requireDealAccess, async (req, res) => {
  const orgIds = req.user!.memberships.map((m) => m.organizationId);
  const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
  if (!doc || doc.dealId !== req.params.dealId) return res.status(404).json({ error: "Document not found" });

  const types = await orgTypeMap(orgIds);
  if (!(await canAccessDocument(doc, orgIds, types))) {
    return res.status(403).json({ error: "Not authorized to view this document" });
  }

  const version = await prisma.documentVersion.findUnique({ where: { id: req.params.versionId } });
  if (!version || version.documentId !== doc.id) return res.status(404).json({ error: "Version not found" });
  if (version.malwareScanStatus !== "clean") {
    return res.status(423).json({ error: `Download blocked — malware scan status: ${version.malwareScanStatus}` });
  }

  const data = await storage.get(version.s3Bucket, version.s3ObjectKey);

  await recordAuditEvent(req, {
    dealId: req.params.dealId,
    objectType: "document_version",
    objectId: version.id,
    action: "download",
  });

  res.setHeader("Content-Type", version.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${version.fileName}"`);
  res.send(data);
});

const shareAccessLevels = new Set(["view", "download", "review"]);

/** Grants an org access to a document with selected_cdes/cde_private share scope. */
documentsRouter.post(
  "/:documentId/access-grants",
  requireRoleOnDealOrg("impact_super_admin", "impact_compliance_manager"),
  async (req, res) => {
    const { organizationId, accessLevel } = req.body as { organizationId?: string; accessLevel?: string };
    if (!organizationId || !accessLevel || !shareAccessLevels.has(accessLevel)) {
      return res.status(400).json({ error: "organizationId and a valid accessLevel are required" });
    }

    const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
    if (!doc || doc.dealId !== req.params.dealId) return res.status(404).json({ error: "Document not found" });

    // Without this, an admin could grant selected_cdes/cde_private access to an org with
    // no relationship to the deal at all — canAccessDocument's grant check only asks
    // "does a grant row exist," so a stray grant to an unrelated org would silently work.
    const targetHasDealTie = await prisma.dealOrganizationAccess.findFirst({
      where: { dealId: req.params.dealId, organizationId },
    });
    if (!targetHasDealTie) {
      return res.status(422).json({ error: "That organization has no access relationship to this deal" });
    }

    const grant = await prisma.documentAccessGrant.upsert({
      where: { documentId_organizationId: { documentId: doc.id, organizationId } },
      create: { documentId: doc.id, organizationId, accessLevel: accessLevel as never, grantedById: req.user!.id },
      update: { accessLevel: accessLevel as never, revokedAt: null, grantedById: req.user!.id, grantedAt: new Date() },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document_access_grant",
      objectId: grant.id,
      action: "grant",
      afterData: grant,
    });

    res.status(201).json(grant);
  }
);
