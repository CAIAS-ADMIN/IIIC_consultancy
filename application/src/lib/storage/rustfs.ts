import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const documentsBucket = env.RUSTFS_BUCKET;

export const s3Client = new S3Client({
  endpoint: env.RUSTFS_ENDPOINT,
  region: env.RUSTFS_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.RUSTFS_ACCESS_KEY,
    secretAccessKey: env.RUSTFS_SECRET_KEY,
  },
});

let bucketReady: Promise<void> | null = null;

/**
 * Origins allowed to PUT/GET objects straight from the browser via presigned
 * URLs: the app's own origin (NEXTAUTH_URL) plus any extra comma-separated
 * STORAGE_CORS_ORIGINS (e.g. a second hostname the portal is served on).
 * Without this rule the browser blocks the upload and shows "Failed to fetch".
 */
function browserOrigins(): string[] {
  const origins = new Set<string>();
  for (const value of [env.NEXTAUTH_URL, ...(process.env.STORAGE_CORS_ORIGINS ?? "").split(",")]) {
    try {
      if (value.trim()) origins.add(new URL(value.trim()).origin);
    } catch {
      // ignore malformed entries
    }
  }
  return [...origins];
}

async function applyBrowserCors() {
  const origins = browserOrigins();
  if (origins.length === 0) return;
  await s3Client.send(
    new PutBucketCorsCommand({
      Bucket: documentsBucket,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3000 }],
      },
    })
  );
}

/** RustFS doesn't auto-create buckets; idempotently ensure ours exists (with its browser CORS rule) before presigning. */
export function ensureBucketExists(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: documentsBucket }));
      } catch {
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: documentsBucket }));
        } catch (createError) {
          const name = (createError as { name?: string })?.name;
          if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
            bucketReady = null;
            throw createError;
          }
        }
      }
      try {
        await applyBrowserCors();
      } catch (corsError) {
        // Uploads from server code still work without it; log so a missing rule is visible.
        console.error("[storage] could not apply bucket CORS rule", corsError);
      }
    })();
  }
  return bucketReady;
}
