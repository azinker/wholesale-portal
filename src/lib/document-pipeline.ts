import { db } from "@/lib/db";
import { downloadFromQuarantine, moveToClean, deleteFile } from "@/lib/storage";
import { scanBuffer } from "@/lib/scanner";

/**
 * Process a document through the ClamAV scan pipeline.
 *
 * Flow:
 * 1. Download file from R2 quarantine
 * 2. Send to ClamAV for scanning
 * 3. If clean → move to clean/ prefix, mark CLEAN
 * 4. If infected → delete from quarantine, mark INFECTED
 * 5. On scan error → leave in quarantine, keep PENDING for retry
 */
export async function processDocumentScan(
  documentId: string,
  storageKey: string
): Promise<void> {
  // Mark as scanning
  await db.document.update({
    where: { id: documentId },
    data: { scanStatus: "SCANNING" },
  });

  try {
    // Download from quarantine
    const buffer = await downloadFromQuarantine(storageKey);

    // Scan with ClamAV
    const result = await scanBuffer(buffer);

    if (result.clean) {
      // Move to clean storage
      await moveToClean(storageKey);

      await db.document.update({
        where: { id: documentId },
        data: { scanStatus: "CLEAN" },
      });

      console.log(`Document ${documentId} scan: CLEAN`);
    } else {
      // Delete infected file from quarantine
      await deleteFile(storageKey, "quarantine");

      await db.document.update({
        where: { id: documentId },
        data: {
          scanStatus: "INFECTED",
          note: `Virus detected: ${result.detail}`,
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          actorEmail: "system",
          action: "document_infected",
          details: {
            documentId,
            storageKey,
            scanResult: result.detail,
          },
        },
      });

      console.warn(`Document ${documentId} scan: INFECTED — ${result.detail}`);
    }
  } catch (error) {
    // ClamAV might be unreachable — leave in quarantine for retry
    const message = error instanceof Error ? error.message : String(error);

    await db.document.update({
      where: { id: documentId },
      data: {
        scanStatus: "PENDING",
        note: `Scan failed (will retry): ${message}`,
      },
    });

    console.error(`Document ${documentId} scan error:`, message);
    throw error;
  }
}
