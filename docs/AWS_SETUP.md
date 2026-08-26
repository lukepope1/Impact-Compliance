# AWS setup: evidence storage (S3 + KMS)

The app's evidence storage is an interface (`server/src/lib/storage.ts`) with two
implementations: local disk for dev, and real S3+KMS (`server/src/lib/s3Storage.ts`) for
everywhere else. Which one runs is decided automatically by whether `EVIDENCE_S3_BUCKET`
is set — no code change needed to switch.

**Not yet deployed or tested against a live AWS account** — this was built in an
environment without AWS credentials. The SDK usage follows the documented AWS SDK v3 API
and the security choices match AWS's own guidance (see below), but review it the way
you'd review infrastructure code from anyone else before trusting it with real evidence:
run it in a sandbox account first.

## What it does

- `s3Storage.ts` implements the same two-method `Storage` interface as local disk
  (`put(bucket, key, data)`, `get(bucket, key)`) — nothing in the application code knows
  or cares which backend is active.
- Every upload is written with `ServerSideEncryption: "aws:kms"` and
  `SSEKMSKeyId: EVIDENCE_KMS_KEY_ARN` — never SSE-S3 (AWS-managed keys). This matches the
  schema's `kms_key_arn` column on `document_versions` and its implementation note
  ("Store files in private S3 with SSE-KMS").
- `verifyStorageReachable()` runs a `HeadBucket` call at server boot when S3 is active, so
  a wrong bucket name, wrong region, or missing IAM permissions fails loudly at startup —
  not on some user's first upload, three requests deep into a demo.
- Credentials are never read from `.env` or hardcoded — the AWS SDK's default credential
  provider chain is used (IAM role in ECS/EKS/EC2, or standard `AWS_ACCESS_KEY_ID`/
  `AWS_SECRET_ACCESS_KEY` env vars / `~/.aws/credentials` locally). Only the *region* and
  *bucket name* come from this app's own env vars.

## Provisioning the bucket + key

`infra/evidence-bucket.yaml` is a CloudFormation template that creates:

- A private S3 bucket: public access fully blocked, versioning enabled (defense-in-depth
  alongside the app's own document-version immutability — even a bug or a compromised
  credential can't silently destroy prior evidence), default encryption SSE-KMS
- A dedicated KMS CMK with rotation enabled, scoped key policy (account root + S3 service
  principal only)
- A bucket policy that **denies** any `PutObject` not using SSE-KMS and denies non-TLS
  requests — enforced server-side, not just "the app happens to always set it"
- A least-privilege `AWS::IAM::ManagedPolicy` scoped to exactly this bucket and this key,
  matching exactly what `s3Storage.ts` calls (`PutObject`, `GetObject`, `HeadBucket` /
  `ListBucket`, plus the KMS actions S3 needs on the app's behalf)

Deploy per environment with a distinct stack name:

```bash
aws cloudformation deploy \
  --template-file infra/evidence-bucket.yaml \
  --stack-name nmtc-compliance-evidence-dev \
  --parameter-overrides BucketNameSuffix=<your-account-id-or-unique-string> Environment=dev \
  --capabilities CAPABILITY_NAMED_IAM
```

Then attach the output `AppPolicyArn` to whatever IAM role the server runs as (an ECS task
role, an EC2 instance profile, etc.) — don't create long-lived access keys for this if you
can avoid it.

## App configuration

Set in the server's environment (see `server/.env.example`):

```bash
AWS_REGION="us-east-1"                                   # from the CloudFormation stack's region
EVIDENCE_S3_BUCKET="nmtc-compliance-evidence-dev-<...>"   # the BucketName output
EVIDENCE_KMS_KEY_ARN="arn:aws:kms:...:key/..."            # the KmsKeyArn output
```

Leave all three unset for local dev — the server falls back to disk automatically.

## What this doesn't do yet

- No lifecycle policy moving old versions to cheaper storage classes (Glacier, etc.) — add
  one to the CloudFormation template if retention costs matter before that's needed
- No cross-region replication / backup strategy
- `s3Storage.ts`'s `get()` buffers the whole object into memory before returning it —
  fine for the financial-statement/rent-roll-sized files this platform handles today, but
  revisit with a streaming response if much larger files become common
- No presigned-URL download path — downloads currently proxy through the API server
  (`documents.ts`'s `/download` route calls `storage.get()` and streams the buffer back),
  which is simpler and keeps the malware-scan-status gate in one place, but means large
  files pass through the app server rather than going client-to-S3 directly
