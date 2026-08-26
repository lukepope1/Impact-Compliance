import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { Storage } from "./storage";

/**
 * Real S3 + KMS evidence storage — the production backend the schema's implementation
 * notes call for ("private S3 with SSE-KMS; bucket public access blocked"). This has NOT
 * been exercised against a live AWS account in this build (no AWS credentials were
 * available in the environment this was built in) — the SDK calls follow the documented
 * API and the encryption/access-control choices below match AWS's own guidance, but treat
 * it as reviewed-but-unverified until your team runs it against a real bucket. See
 * docs/AWS_SETUP.md for the bucket/KMS/IAM provisioning this expects.
 *
 * Every object is written with SSE-KMS using EVIDENCE_KMS_KEY_ARN — never SSE-S3 (AWS-
 * managed keys) — so key access/rotation/audit go through KMS, matching the schema's
 * "kms_key_arn" column on document_versions. bucket-key-enabled is left on the bucket's
 * default encryption config, not forced per-request, so this class doesn't assume one.
 */
export class S3Storage implements Storage {
  private client: S3Client;
  private kmsKeyArn: string | undefined;

  constructor(region: string, kmsKeyArn?: string) {
    this.client = new S3Client({ region });
    this.kmsKeyArn = kmsKeyArn;
  }

  /** Cheap connectivity/permission check at boot — fails fast with a clear error instead of on the first upload. */
  async assertReachable(bucket: string): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
  }

  async put(bucket: string, key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: this.kmsKeyArn, // undefined lets S3 use the bucket's default KMS key — never falls back to SSE-S3
      })
    );
  }

  async get(bucket: string, key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`S3 object has no body: s3://${bucket}/${key}`);
    // Body is a Node.js Readable in the Node runtime (the SDK types it as a union across
    // runtimes — browser ReadableStream, etc. — because the same package ships everywhere).
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
