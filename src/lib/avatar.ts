import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function bucket() {
  return process.env.R2_BUCKET_NAME || "tpp-wholesale-docs";
}

/**
 * Generate a signed avatar URL for a given R2 avatar key.
 * Returns null if avatarKey is null/undefined or if R2 env vars are missing.
 */
export async function getAvatarUrl(avatarKey: string | null | undefined): Promise<string | null> {
  if (!avatarKey) return null;
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null;
  }

  try {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: avatarKey,
      }),
      { expiresIn: 3600 }
    );
    return url;
  } catch {
    return null;
  }
}

/**
 * Batch-generate signed avatar URLs for multiple users.
 * Returns a Map of userId -> avatarUrl.
 */
export async function getAvatarUrls(
  users: { id: string; avatarKey: string | null }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const usersWithAvatars = users.filter((u) => u.avatarKey);

  if (usersWithAvatars.length === 0) return result;

  const entries = await Promise.all(
    usersWithAvatars.map(async (u) => {
      const url = await getAvatarUrl(u.avatarKey);
      return [u.id, url] as const;
    })
  );

  for (const [id, url] of entries) {
    if (url) result.set(id, url);
  }

  return result;
}
