import { db } from "@/lib/db";

/**
 * Virus scanning is retired. New and retried docs are marked CLEAN.
 * Do not email partners from this path.
 */
export async function processDocumentScan(documentId: string): Promise<void> {
  await db.document.update({
    where: { id: documentId },
    data: { scanStatus: "CLEAN" },
  });
}
