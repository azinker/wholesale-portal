import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToQuarantine } from "@/lib/storage";
import { processDocumentScan } from "@/lib/document-pipeline";
import { randomCode } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = user.wholesaleAccount;
    if (!account) {
      return NextResponse.json(
        { error: "No wholesale account found. Please apply first." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("docType") as string) || "other";
    const state = (formData.get("state") as string) || null;
    const note = (formData.get("note") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted: PDF, JPEG, PNG, WebP, GIF` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    // Generate a unique storage key
    const ext = file.name.split(".").pop() || "bin";
    const storageKey = `${account.id}/${Date.now()}-${randomCode(8)}.${ext}`;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2 quarantine zone
    await uploadToQuarantine(storageKey, buffer, file.type);

    // Create document record
    const doc = await db.document.create({
      data: {
        accountId: account.id,
        filename: file.name,
        mime: file.type,
        size: file.size,
        storageKey,
        scanStatus: "PENDING",
        docType,
        state,
        note,
      },
    });

    // Trigger async ClamAV scan (don't block the response)
    processDocumentScan(doc.id, storageKey).catch((err) => {
      console.error(`Document scan failed for ${doc.id}:`, err);
    });

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      scanStatus: doc.scanStatus,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
