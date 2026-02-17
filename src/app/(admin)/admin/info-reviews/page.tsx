import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { FileEdit, ArrowRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { getAvatarUrls } from "@/lib/avatar";
import InfoReviewActions from "./info-review-actions";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const FIELD_LABELS: Record<string, string> = {
  companyName: "Company Name",
  legalName: "Legal Name",
  phone: "Phone",
  businessAddress: "Address",
  primaryState: "State",
  website: "Website",
};

export default async function InfoReviewsPage() {
  const changeRequests = await db.businessInfoChange.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      account: {
        include: {
          user: { select: { id: true, avatarKey: true } },
        },
      },
    },
  });

  // Split by status
  const pending = changeRequests.filter((r) => r.status === "PENDING");
  const reviewed = changeRequests.filter((r) => r.status !== "PENDING");

  // Batch avatar URLs
  const avatarMap = await getAvatarUrls(
    changeRequests.map((r) => ({ id: r.account.userId, avatarKey: r.account.user.avatarKey }))
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileEdit className="h-6 w-6 text-primary" />
          Business Info Reviews
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and approve business information change requests from wholesale customers.
        </p>
      </div>

      {/* Pending Reviews */}
      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-10 w-10 text-success/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No pending reviews. All clear!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Reviews
            <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
          </h2>
          {pending.map((req) => {
            const oldVals = req.oldValues as Record<string, string | null>;
            const newVals = req.newValues as Record<string, string>;
            const avatarUrl = avatarMap.get(req.account.userId) ?? null;

            return (
              <Card key={req.id} className="border-warning/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border flex-shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={req.account.companyName} />}
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {getInitials(req.account.companyName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{req.account.companyName}</CardTitle>
                      <CardDescription>{req.account.email}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {req.createdAt.toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Changes diff */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-4 py-2 font-medium text-xs">Field</th>
                          <th className="text-left px-4 py-2 font-medium text-xs">Current</th>
                          <th className="text-left px-4 py-2 font-medium text-xs">
                            <ArrowRight className="h-3 w-3 inline mr-1" />
                            Requested
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(newVals).map(([key, newVal]) => (
                          <tr key={key} className="border-b last:border-0">
                            <td className="px-4 py-2 text-muted-foreground text-xs font-medium">
                              {FIELD_LABELS[key] || key}
                            </td>
                            <td className="px-4 py-2 text-xs line-through opacity-50">
                              {oldVals[key] || "—"}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-primary">
                              {newVal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <InfoReviewActions changeRequestId={req.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Previously Reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-lg font-semibold text-muted-foreground">Recent History</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Company</th>
                    <th className="text-left px-4 py-3 font-medium">Fields Changed</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Reviewed By</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewed.map((req) => {
                    const newVals = req.newValues as Record<string, string>;
                    return (
                      <tr key={req.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{req.account.companyName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {Object.keys(newVals).map((k) => FIELD_LABELS[k] || k).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "APPROVED" ? (
                            <Badge variant="default" className="text-[10px]">Approved</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Denied</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {req.reviewedBy || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {req.reviewedAt?.toLocaleDateString() || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
