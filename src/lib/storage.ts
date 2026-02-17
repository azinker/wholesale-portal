import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3: S3Client | null = null;

function getClient(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME || "tpp-wholesale-docs";
}

/**
 * Upload a file buffer to R2.
 * Files go to quarantine/ prefix first, then moved to clean/ after scan.
 */
export async function uploadToQuarantine(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: `quarantine/${key}`,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Move a file from quarantine/ to clean/ after it passes AV scan.
 * R2 doesn't have a native "move" — we copy + delete.
 */
export async function moveToClean(key: string): Promise<void> {
  const client = getClient();
  const b = bucket();

  // Get the quarantined object
  const getRes = await client.send(
    new GetObjectCommand({ Bucket: b, Key: `quarantine/${key}` })
  );

  const body = await getRes.Body?.transformToByteArray();
  if (!body) throw new Error(`Empty body for quarantine/${key}`);

  // Put into clean/
  await client.send(
    new PutObjectCommand({
      Bucket: b,
      Key: `clean/${key}`,
      Body: body,
      ContentType: getRes.ContentType,
    })
  );

  // Delete from quarantine/
  await client.send(
    new DeleteObjectCommand({ Bucket: b, Key: `quarantine/${key}` })
  );
}

/**
 * Delete a file from R2 (either prefix).
 */
export async function deleteFile(key: string, prefix: "quarantine" | "clean"): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: `${prefix}/${key}`,
    })
  );
}

/**
 * Get a pre-signed URL for a clean file (admin viewing).
 * Expires in 15 minutes by default.
 */
export async function getSignedViewUrl(
  key: string,
  expiresIn = 900
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: `clean/${key}`,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Download a file from quarantine for ClamAV scanning.
 */
export async function downloadFromQuarantine(key: string): Promise<Buffer> {
  const res = await getClient().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: `quarantine/${key}`,
    })
  );

  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty body for quarantine/${key}`);
  return Buffer.from(bytes);
}
