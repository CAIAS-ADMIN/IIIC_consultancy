import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
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

/** RustFS doesn't auto-create buckets; idempotently ensure ours exists before presigning. */
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
    })();
  }
  return bucketReady;
}
