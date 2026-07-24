import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, AlertTriangle } from "lucide-react";
import DocumentUploader from "./document-uploader";

export default async function DocumentsPage() {
  const user = await getUser();
  if (!user) redirect("/");
  if (user.wholesaleAccount?.partnerType === "AFFILIATE_PUBLISHER") redirect("/dashboard");

  const account = user.wholesaleAccount;

  const documents = account
    ? await db.document.findMany({
        where: { accountId: account.id },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true, filename: true, mime: true, size: true,
          scanStatus: true, docType: true, state: true, note: true, uploadedAt: true,
        },
      })
    : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload resale certificates, business licenses, and other required documents.
        </p>
      </div>

      {!account ? (
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              You need to submit a wholesale application before uploading documents.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DocumentUploader
          initialDocuments={documents.map((d) => ({
            ...d,
            scanStatus: d.scanStatus as string,
            uploadedAt: d.uploadedAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
