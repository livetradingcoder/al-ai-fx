// src/lib/object-storage.ts
//
// S3-compatible object storage (MinIO on Coolify; works with any S3 API).
// Replaces @vercel/blob after the Vercel -> self-hosted migration. Keys are
// plain pathnames (e.g. "sources/goldbot/v1.mq5.enc", "compiled/AL-ai-FX_....ex5")
// — no public URLs exist; every read goes through an authenticated route that
// calls objectGet() server-side, preserving the private-proxy pattern.
//
// Env (server-only):
//   S3_ENDPOINT          e.g. http://minio-xxxx:9000 (internal docker DNS)
//   S3_ACCESS_KEY_ID
//   S3_SECRET_ACCESS_KEY
//   S3_BUCKET            e.g. al-ai-fx
//   S3_REGION            optional, default us-east-1 (MinIO ignores it)
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage env not configured (S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)");
  }
  _client = new S3Client({
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for MinIO
  });
  return _client;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET not configured");
  return b;
}

/** Upload a buffer at `key`. Overwrites unless `ifNoneMatch` is set. */
export async function objectPut(
  key: string,
  body: Buffer,
  opts?: { contentType?: string; immutable?: boolean },
): Promise<{ key: string }> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: opts?.contentType ?? "application/octet-stream",
      // Immutability: S3 conditional write — fails if the object already exists.
      ...(opts?.immutable ? { IfNoneMatch: "*" } : {}),
    }),
  );
  return { key };
}

/** Read the full object at `key` into a Buffer. Throws if missing. */
export async function objectGet(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!res.Body) throw new Error(`object not found: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}
