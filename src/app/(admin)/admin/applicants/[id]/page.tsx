import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink, UserPlus, Download } from "lucide-react";
import { ImpersonateButton } from "@/components/impersonate-button";
import { RemoveApplicantButton } from "@/components/remove-applicant-button";
import { getAvatarUrl } from "@/lib/avatar";
import ApplicantActions from "./applicant-actions";

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const account = await db.wholesaleAccount.findUnique({
    where: { id },
    include: {
      user: true,
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true, filename: true, mime: true, size: true,
          scanStatus: true, docType: true, state: true, note: true, uploadedAt: true,
        },
      },
      riskFlags: { where: { status: "OPEN" } },
    },
  });

  if (!account) notFound();

  const businessFields = (account.businessFields as Record<string, string>) || {};
  const avatarUrl = await getAvatarUrl(account.user.avatarKey);

  // Check if this customer was manually enrolled by an admin
  const enrollAudit = await db.auditLog.findFirst({
    where: {
      action: "admin_enroll_customer",
      targetAccountId: id,
    },
    orderBy: { createdAt: "desc" },
  });

  /** Get initials from company name */
  function getInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/applicants"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Avatar className="h-12 w-12 border-2 border-border flex-shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={account.companyName} />}
          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
            {getInitials(account.companyName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{account.companyName}</h1>
          <p className="text-muted-foreground text-sm">{account.email}</p>
        </div>
        <ImpersonateButton userId={account.userId} userEmail={account.email} size="sm" />
        <RemoveApplicantButton
          accountId={account.id}
          companyName={account.companyName}
          email={account.email}
        />
        <StatusBadge status={account.status} />
      </div>

      {/* Manually Enrolled Badge */}
      {enrollAudit && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Manually Enrolled by {enrollAudit.actorEmail}
              </p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                {enrollAudit.createdAt.toLocaleDateString()} at {enrollAudit.createdAt.toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Application Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Company Name" value={account.companyName} />
            <Field label="Alias" value={account.alias} />
            <Field label="Legal Name" value={account.legalName} />
            <Field label="Contact" value={`${businessFields.firstName || ""} ${businessFields.lastName || ""}`.trim()} />
            <Field label="Email" value={account.email} />
            <Field label="Phone" value={account.phone} />
            <Field label="Address" value={account.businessAddress} />
            <Field label="Website" value={account.website} />
            <Field label="State" value={account.primaryState} />
            <Field label="BC Customer" value={account.customerId ? `#${account.customerId}` : "Not linked"} />
            <Field label="Applied" value={account.createdAt.toLocaleString()} />
            <Field label="Attestation" value={account.attestation ? "Yes" : "No"} />
          </dl>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documents ({account.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {account.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium">File</th>
                    <th className="text-left px-4 py-2.5 font-medium">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium">State</th>
                    <th className="text-left px-4 py-2.5 font-medium">Scan</th>
                    <th className="text-left px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {account.documents.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{doc.filename}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{doc.docType || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{doc.state || "—"}</td>
                      <td className="px-4 py-2.5"><ScanBadge status={doc.scanStatus} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {doc.scanStatus === "CLEAN" && (
                            <>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/api/admin/documents/${doc.id}/view`} target="_blank" rel="noopener noreferrer">
                                  View <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/api/admin/documents/${doc.id}/download`} download>
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Flags */}
      {account.riskFlags.length > 0 && (
        <Card className="border-danger/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-danger">
              <AlertTriangle className="h-4 w-4" />
              Open Risk Flags ({account.riskFlags.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.riskFlags.map((flag) => (
              <div key={flag.id} className="rounded-lg bg-danger-light/50 border border-danger/10 px-4 py-3 text-sm">
                <span className="font-medium">{flag.type}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {JSON.stringify(flag.details)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions or Status */}
      {(account.status === "PENDING" || account.status === "RETAIL") && (
        <ApplicantActions accountId={account.id} currentStatus={account.status} />
      )}

      {account.status === "DENIED" && account.denialReason && (
        <Card className="border-danger/30 bg-danger-light/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger">Denied</p>
              <p className="text-sm text-muted-foreground mt-1">{account.denialReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {account.status === "APPROVED" && (
        <Card className="border-success/30 bg-success-light/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-success">Approved</p>
              <p className="text-sm text-muted-foreground mt-1">
                Approved on {account.approvedAt?.toLocaleString() || "unknown date"}.
                Current tier: {account.lastTier || "NONE"}.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-3">
                <Link href={`/admin/customers/${account.id}`}>
                  Manage Customer <ArrowLeft className="ml-1 h-3 w-3 rotate-180" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary", APPROVED: "default", DENIED: "destructive", RETAIL: "outline",
  };
  return <Badge variant={variants[status] || "outline"} className="text-xs">{status}</Badge>;
}

function ScanBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    CLEAN: "default", INFECTED: "destructive", SCANNING: "secondary", PENDING: "outline",
  };
  return <Badge variant={variants[status] || "outline"} className="text-[10px]">{status}</Badge>;
}
