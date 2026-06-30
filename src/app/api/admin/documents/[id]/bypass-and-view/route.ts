import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { moveToClean, getSignedViewUrl } from "@/lib/storage";

/** GET /api/admin/documents/[id]/bypass-and-view — bypass scan then redirect to view (for PENDING docs) */
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

    if (doc.scanStatus === "INFECTED") {
      return NextResponse.json(
        { error: "Cannot bypass view on infected documents" },
        { status: 400 }
      );
    }

    if (doc.scanStatus !== "CLEAN") {
      // Bypass: move to clean and mark CLEAN
      await moveToClean(doc.storageKey);
      await db.document.update({
        where: { id },
        data: {
          scanStatus: "CLEAN",
          note: `Admin bypass by ${user.email} - scan skipped`,
        },
      });
      await db.auditLog.create({
        data: {
          actorEmail: user.email,
          action: "document_scan_bypassed",
          details: { documentId: id, storageKey: doc.storageKey, reason: "Bypass and view" },
        },
      });
    }

    const url = await getSignedViewUrl(doc.storageKey);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Bypass and view error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
