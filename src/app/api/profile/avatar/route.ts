import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

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

/** GET: Return a signed URL for the current user's avatar */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-fetch from DB to get the raw avatarKey
  const dbUser = await db.portalUser.findUnique({
    where: { id: user.id },
    select: { avatarKey: true },
  });

  if (!dbUser?.avatarKey) {
    return NextResponse.json({ url: null });
  }

  const url = await getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: dbUser.avatarKey,
    }),
    { expiresIn: 3600 }
  );

  return NextResponse.json({ url });
}

/** POST: Upload a new avatar */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2MB." },
      { status: 400 }
    );
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `avatars/${user.id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  // Update user's avatar key
  await db.portalUser.update({
    where: { id: user.id },
    data: { avatarKey: key },
  });

  return NextResponse.json({ success: true, key });
}
