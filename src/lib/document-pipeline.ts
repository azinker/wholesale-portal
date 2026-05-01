import { db } from "@/lib/db";
import { downloadFromQuarantine, moveToClean, deleteFile } from "@/lib/storage";
import { scanBuffer } from "@/lib/scanner";
import { sendDocumentIssueEmail } from "@/lib/email";

/**
 * Process a document through the ClamAV scan pipeline.
 *
 * Flow:
 * 1. Download file from R2 quarantine
 * 2. Send to ClamAV for scanning
 * 3. If clean, move to clean/ prefix and mark CLEAN
 * 4. If infected, delete from quarantine and mark INFECTED
 * 5. On scan error, leave in quarantine and keep PENDING for retry
 */
export async function processDocumentScan(
  documentId: string,
  storageKey: string
): Promise<void> {
  await db.document.update({
    where: { id: documentId },
    data: { scanStatus: "SCANNING" },
  });

  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { account: true },
  });

  try {
    const buffer = await downloadFromQuarantine(storageKey);
    const result = await scanBuffer(buffer);

    if (result.clean) {
      await moveToClean(storageKey);

      await db.document.update({
        where: { id: documentId },
        data: { scanStatus: "CLEAN" },
      });

      console.log(`Document ${documentId} scan: CLEAN`);
    } else {
      await deleteFile(storageKey, "quarantine");

      await db.document.update({
        where: { id: documentId },
        data: {
          scanStatus: "INFECTED",
          note: `Virus detected: ${result.detail}`,
        },
      });

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

      if (document) {
        await sendDocumentIssueEmail(
          document.account.email,
          document.account.companyName,
          document.filename,
          "rejected",
          `Virus detected: ${result.detail}`
        );
      }

      console.warn(`Document ${documentId} scan: INFECTED - ${result.detail}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db.document.update({
      where: { id: documentId },
      data: {
        scanStatus: "PENDING",
        note: `Scan failed (will retry): ${message}`,
      },
    });

    if (document) {
      const recentlySent = await db.auditLog.findFirst({
        where: {
          action: "document_scan_failed_email_sent",
          targetAccountId: document.accountId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentlySent) {
        console.error(`Document ${documentId} scan error:`, message);
        throw error;
      }

      await sendDocumentIssueEmail(
        document.account.email,
        document.account.companyName,
        document.filename,
        "scan_failed",
        message
      );
      await db.auditLog.create({
        data: {
          actorEmail: "system",
          action: "document_scan_failed_email_sent",
          targetAccountId: document.accountId,
          details: { documentId, storageKey, message },
        },
      });
    }

    console.error(`Document ${documentId} scan error:`, message);
    throw error;
  }
}
