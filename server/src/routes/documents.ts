import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { recordAuditEvent } from "../lib/audit";
import { storage, EVIDENCE_BUCKET, sanitizeFileName } from "../lib/storage";
import { canAccessDocument, orgTypeMap } from "../lib/documentAccess";
import { requireDealAccess, requireRole } from "../middleware/auth";

export const documentsRouter = Router({ mergeParams: true });

// 25MB cap — plenty for the financial statements / rent rolls this platform handles;
// tighten or raise per document_type later if a category needs more.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

/**
 * Uploads the first version of a new document. malware_scan_status starts "pending" —
 * in production a scanning pipeline flips it to clean/infected before download is
 * allowed; locally there's no scanner wired up, so it's flipped to "clean" immediately
 * (see the TODO below) so the dev flow isn't blocked.
 */
documentsRouter.post(
  "/",
  requireDealAccess,
  requireRole(
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
            malwareScanStatus: "clean", // TODO(Phase 2 hardening): wire a real scan pipeline before go-live
            uploadedById: req.user!.id,
          },
        },
      },
      include: { versions: true },
    });

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document",
      objectId: doc.id,
      action: "upload",
      afterData: { title: doc.title, documentType: doc.documentType, checksum },
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
  requireDealAccess,
  requireRole(
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
          malwareScanStatus: "clean",
          uploadedById: req.user!.id,
        },
      }),
      prisma.document.update({ where: { id: doc.id }, data: { currentVersion: nextVersion } }),
    ]);

    await recordAuditEvent(req, {
      dealId: req.params.dealId,
      objectType: "document_version",
      objectId: version.id,
      action: "upload_new_version",
      afterData: { documentId: doc.id, versionNumber: nextVersion, checksum },
    });

    res.status(201).json(version);
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
  requireDealAccess,
  requireRole("impact_super_admin", "impact_compliance_manager"),
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
