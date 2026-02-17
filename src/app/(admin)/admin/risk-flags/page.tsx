import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import RiskFlagActions from "./risk-flag-actions";

export default async function RiskFlagsPage() {
  const flags = await db.riskFlag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      account: {
        select: { id: true, companyName: true, email: true, customerId: true },
      },
    },
  });

  const clearedFlags = await db.riskFlag.findMany({
    where: { status: { in: ["CLEARED", "KEPT"] } },
    orderBy: { clearedAt: "desc" },
    take: 20,
    include: {
      account: { select: { id: true, companyName: true } },
    },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-primary" />
          Risk Flags
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and resolve suspicious activity flags.
        </p>
      </div>

      {flags.length === 0 ? (
        <Card className="border-success/30 bg-success-light/30">
          <CardContent className="py-8 text-center flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-success" />
            <p className="text-sm text-success font-medium">All clear! No open risk flags.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <Card key={flag.id} className="border-danger/30">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="destructive" className="text-[10px] mb-2">
                      {flag.type.replace(/_/g, " ")}
                    </Badge>
                    <h3 className="font-semibold">
                      <Link href={`/admin/applicants/${flag.account.id}`} className="text-primary hover:underline">
                        {flag.account.companyName}
                      </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {flag.account.email} &middot; BC #{flag.account.customerId}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{flag.createdAt.toLocaleString()}</span>
                </div>
                <div className="bg-muted rounded-lg p-3 text-xs font-mono mb-3 overflow-auto max-h-32">
                  <pre>{JSON.stringify(flag.details, null, 2)}</pre>
                </div>
                <RiskFlagActions flagId={flag.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {clearedFlags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">
              Recently Resolved ({clearedFlags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium">Company</th>
                    <th className="text-left px-4 py-2.5 font-medium">Resolution</th>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {clearedFlags.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 text-xs">{f.type}</td>
                      <td className="px-4 py-2.5">{f.account.companyName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={f.status === "CLEARED" ? "default" : "secondary"} className="text-[10px]">
                          {f.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{f.clearedAt?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
