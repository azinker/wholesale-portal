import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { moveToClean } from "@/lib/storage";

/** POST /api/admin/documents/[id]/bypass-scan — mark document as CLEAN without scanning (admin override) */
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

    if (doc.scanStatus === "CLEAN") {
      return NextResponse.json(
        { error: "Document is already marked as CLEAN" },
        { status: 400 }
      );
    }

    // Move file from quarantine to clean storage
    await moveToClean(doc.storageKey);

    // Mark as CLEAN with admin bypass note
    await db.document.update({
      where: { id },
      data: {
        scanStatus: "CLEAN",
        note: `Admin bypass by ${user.email} - scan skipped`,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "document_scan_bypassed",
        details: {
          documentId: id,
          storageKey: doc.storageKey,
          reason: "Admin manual bypass",
        },
      },
    });

    console.log(`Document ${id} marked CLEAN by admin bypass (${user.email})`);

    return NextResponse.json({ success: true, scanStatus: "CLEAN" });
  } catch (error) {
    console.error("Document bypass scan error:", error);
    const message = error instanceof Error ? error.message : "Bypass failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
