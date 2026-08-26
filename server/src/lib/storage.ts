import fs from "fs";
import path from "path";

/**
 * Evidence storage abstraction. Production points this at private S3 with SSE-KMS
 * (per the schema's implementation notes) once AWS_REGION/EVIDENCE_S3_BUCKET are set.
 * Local dev falls back to disk under server/.evidence-storage/ so the upload → version
 * → download flow is fully testable without AWS credentials.
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

// Swap in a real S3-backed implementation here once EVIDENCE_S3_BUCKET is set in production.
export const storage: Storage = new LocalDiskStorage();

export const EVIDENCE_BUCKET = process.env.EVIDENCE_S3_BUCKET || "nmtc-compliance-local-dev";
