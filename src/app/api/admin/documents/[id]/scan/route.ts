import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { processDocumentScan } from "@/lib/document-pipeline";

/** POST /api/admin/documents/[id]/scan — manually trigger virus scan for a pending document */
export async function POST(
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

    if (doc.scanStatus !== "PENDING") {
      return NextResponse.json(
        { error: `Document scan status is already: ${doc.scanStatus}` },
        { status: 400 }
      );
    }

    // Trigger scan
    await processDocumentScan(doc.id, doc.storageKey);

    // Fetch updated status
    const updated = await db.document.findUnique({ where: { id } });

    return NextResponse.json({
      success: true,
      scanStatus: updated?.scanStatus || "PENDING",
    });
  } catch (error) {
    console.error("Manual document scan error:", error);
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
