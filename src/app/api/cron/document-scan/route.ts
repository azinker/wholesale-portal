import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processDocumentScan } from "@/lib/document-pipeline";

/**
 * POST /api/cron/document-scan
 * Cron job to retry pending document scans.
 * Runs every 15 minutes to process documents stuck in PENDING status.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();

    // Find all pending documents (older than 1 minute to avoid race conditions with fresh uploads)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const pendingDocs = await db.document.findMany({
      where: {
        scanStatus: "PENDING",
        uploadedAt: { lt: oneMinuteAgo },
      },
      take: 50, // Process up to 50 at a time
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const doc of pendingDocs) {
      processed++;
      try {
        await processDocumentScan(doc.id, doc.storageKey);
        succeeded++;
      } catch (err) {
        failed++;
        console.error(`Document scan retry failed for ${doc.id}:`, err);
      }
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `Document scan cron complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed (${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
      elapsed,
    });
  } catch (error) {
    console.error("Document scan cron error:", error);
    return NextResponse.json(
      { error: "Document scan cron failed" },
      { status: 500 }
    );
  }
}
