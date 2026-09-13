import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/cron/document-scan
 * Scanning is disabled. Any leftover PENDING/SCANNING rows are marked CLEAN
 * with no partner email.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.document.updateMany({
    where: { scanStatus: { in: ["PENDING", "SCANNING"] } },
    data: { scanStatus: "CLEAN" },
  });

  return NextResponse.json({
    success: true,
    scanningDisabled: true,
    markedClean: result.count,
  });
}
