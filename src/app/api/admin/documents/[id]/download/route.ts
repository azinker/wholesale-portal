import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/storage";

/** GET /api/admin/documents/[id]/download — redirect admin to a signed URL for downloading a clean document */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.scanStatus !== "CLEAN") {
      return NextResponse.json(
        { error: `Cannot download document with scan status: ${doc.scanStatus}` },
        { status: 400 }
      );
    }

    const url = await getSignedDownloadUrl(doc.storageKey, doc.filename);

    // Redirect to the signed URL for download
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
