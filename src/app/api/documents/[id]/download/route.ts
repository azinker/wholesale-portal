import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/portal-auth";
import { db } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/storage";

/** GET /api/documents/[id]/download — download own account document */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePortalAccount("view_documents");
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const { id } = await params;

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc || doc.accountId !== user.wholesaleAccount!.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.scanStatus !== "CLEAN") {
      return NextResponse.json(
        { error: "Document is not available for download yet" },
        { status: 403 }
      );
    }

    const url = await getSignedDownloadUrl(doc.storageKey, doc.filename);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Failed to download document" }, { status: 500 });
  }
}
