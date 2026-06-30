import { NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/portal-auth";
import { db } from "@/lib/db";

/** GET /api/documents — list the current user's documents */
export async function GET() {
  try {
    const auth = await requirePortalAccount("view_documents");
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const account = user.wholesaleAccount!;

    const documents = await db.document.findMany({
      where: { accountId: account.id },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        filename: true,
        mime: true,
        size: true,
        scanStatus: true,
        docType: true,
        state: true,
        note: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Documents list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
