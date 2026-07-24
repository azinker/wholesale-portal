import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImpersonateButton } from "@/components/impersonate-button";
import { Users, ArrowRight } from "lucide-react";
import { getAvatarUrls } from "@/lib/avatar";

/** Get initials from a company name */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const applicants = await db.wholesaleAccount.findMany({
    where: type === "publisher"
      ? { partnerType: "AFFILIATE_PUBLISHER" }
      : type === "reseller"
        ? { partnerType: "DROPSHIPPER" }
        : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      user: {
        select: { id: true, avatarKey: true },
      },
      documents: { select: { id: true, scanStatus: true } },
    },
  });

  // Batch-fetch avatar URLs for all users who have one
  const avatarMap = await getAvatarUrls(
    applicants.map((a) => ({ id: a.userId, avatarKey: a.user.avatarKey }))
  );

  const pendingCount = applicants.filter((a) => a.status === "PENDING").length;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Applicants
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and manage reseller and affiliate publisher applications.
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-warning border-warning/30">
                {pendingCount} pending
              </Badge>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={!type ? "default" : "outline"} size="sm" asChild><Link href="/admin/applicants">All</Link></Button>
        <Button variant={type === "reseller" ? "default" : "outline"} size="sm" asChild><Link href="/admin/applicants?type=reseller">Resellers</Link></Button>
        <Button variant={type === "publisher" ? "default" : "outline"} size="sm" asChild><Link href="/admin/applicants?type=publisher">Publishers</Link></Button>
      </div>

      {applicants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No applications yet. They will appear here when customers apply.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Applicant</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Program</th>
                  <th className="text-left px-4 py-3 font-medium">Docs</th>
                  <th className="text-left px-4 py-3 font-medium">Applied</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => {
                  const cleanDocs = a.documents.filter((d) => d.scanStatus === "CLEAN").length;
                  const totalDocs = a.documents.length;
                  const avatarUrl = avatarMap.get(a.userId) ?? null;

                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border flex-shrink-0">
                            {avatarUrl && <AvatarImage src={avatarUrl} alt={a.companyName} />}
                            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                              {getInitials(a.companyName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{a.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PartnerBadge partnerType={a.partnerType} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {totalDocs === 0 ? "—" : `${cleanDocs}/${totalDocs} clean`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {a.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="xs" asChild>
                          <Link href={`/admin/applicants/${a.id}`}>
                            Review <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <ImpersonateButton userId={a.userId} userEmail={a.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PartnerBadge({ partnerType }: { partnerType: string }) {
  return <Badge variant={partnerType === "AFFILIATE_PUBLISHER" ? "secondary" : "outline"} className="whitespace-nowrap">{partnerType === "AFFILIATE_PUBLISHER" ? "Publisher" : "Reseller"}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary",
    APPROVED: "default",
    DENIED: "destructive",
    RETAIL: "outline",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}
