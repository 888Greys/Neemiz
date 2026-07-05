import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 (S3-compatible) object storage.
 *
 * Uploads (avatars, P2P chat images) used to live in Supabase Storage. After
 * the self-host cutover those buckets became unreliable, so we store objects in
 * R2 and serve them from a public custom domain fronted by Cloudflare.
 *
 * All credentials are server-only — clients upload via `/api/upload`, never
 * touching R2 directly.
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = process.env.R2_BUCKET ?? "";
/** Public base URL for served objects, e.g. https://cdn.nezeem.com (no trailing slash). */
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

/** True when every piece of R2 config is present. */
export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && R2_BUCKET && R2_PUBLIC_BASE_URL);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

/**
 * Upload a file to R2 and return its public URL.
 * @param key    Object key (path within the bucket), e.g. "avatars/<uid>/<ts>.jpg"
 * @param body   File bytes
 * @param contentType MIME type, stored so the CDN serves the right header
 */
export async function uploadToR2(key: string, body: Uint8Array | Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}
