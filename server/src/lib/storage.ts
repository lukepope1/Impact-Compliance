import fs from "fs";
import path from "path";
import { S3Storage } from "./s3Storage";

/**
 * Evidence storage abstraction. Local dev falls back to disk under
 * server/.evidence-storage/ so the upload → version → download flow is fully testable
 * without AWS credentials. Setting AWS_REGION + EVIDENCE_S3_BUCKET switches this to real
 * S3 with SSE-KMS (see s3Storage.ts and docs/AWS_SETUP.md for the bucket/KMS/IAM this
 * expects) — the switch is automatic, not a manual code change, so the same server binary
 * runs unmodified in both environments.
 *
 * Either way, callers only ever get a bucket+key pair back — nothing above this module
 * knows or cares which backend is in use.
 */
export interface StoredObject {
  bucket: string;
  key: string;
}

export interface Storage {
  put(bucket: string, key: string, data: Buffer): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer>;
}

class LocalDiskStorage implements Storage {
  private root = path.join(__dirname, "..", "..", ".evidence-storage");

  private resolve(bucket: string, key: string) {
    // key already contains slashes as a path (dealId/documentId/version); bucket becomes a top-level dir.
    return path.join(this.root, bucket, key);
  }

  async put(bucket: string, key: string, data: Buffer) {
    const filePath = this.resolve(bucket, key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  async get(bucket: string, key: string) {
    return fs.promises.readFile(this.resolve(bucket, key));
  }
}

export const EVIDENCE_BUCKET = process.env.EVIDENCE_S3_BUCKET || "nmtc-compliance-local-dev";

const usingS3 = !!process.env.EVIDENCE_S3_BUCKET;

if (usingS3 && !process.env.AWS_REGION) {
  throw new Error("EVIDENCE_S3_BUCKET is set but AWS_REGION is not — both are required to use real S3 storage.");
}
if (usingS3 && !process.env.EVIDENCE_KMS_KEY_ARN) {
  // Not fatal: omitting SSEKMSKeyId lets S3 fall back to the bucket's default KMS key,
  // which is fine if the bucket's default encryption config already points at the right
  // CMK — but a silently-wrong key on a compliance evidence store is worth a loud warning.
  console.warn(
    "EVIDENCE_S3_BUCKET is set but EVIDENCE_KMS_KEY_ARN is not — uploads will use the bucket's default KMS key. " +
      "Set EVIDENCE_KMS_KEY_ARN explicitly unless that default is intentional."
  );
}

const s3Storage = usingS3 ? new S3Storage(process.env.AWS_REGION!, process.env.EVIDENCE_KMS_KEY_ARN) : null;
export const storage: Storage = s3Storage ?? new LocalDiskStorage();

/**
 * Call once at boot when using S3, so a missing bucket / wrong region / bad credentials
 * fails loudly at startup instead of on the first user's upload. No-op for local disk.
 */
export async function verifyStorageReachable(): Promise<void> {
  if (!s3Storage) return;
  await s3Storage.assertReachable(EVIDENCE_BUCKET);
}

/**
 * A client-supplied upload filename is untrusted input. Used raw, it can escape the
 * storage root via path segments (`../../etc/...`) — LocalDiskStorage builds its path
 * with `path.join`, which happily walks up out of the intended tree — and can break the
 * download response's Content-Disposition header if it contains quotes or CR/LF. Strip
 * to a safe basename before it ever reaches a storage key or a header.
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, ""); // drop any path component, keep only the leaf name
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200);
  return cleaned || "file";
}
