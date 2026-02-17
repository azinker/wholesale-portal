import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/documents — list the current user's documents */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = user.wholesaleAccount;
    if (!account) {
      return NextResponse.json({ documents: [] });
    }

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
