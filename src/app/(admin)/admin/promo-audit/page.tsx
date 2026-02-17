"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface FlaggedPromo {
  id: number;
  name: string;
  status: string;
  reason: string;
}

export default function PromoAuditPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    totalPromotions: number;
    flaggedPromotions: FlaggedPromo[];
  } | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-audit", { method: "POST" });
      if (!res.ok) throw new Error("Audit failed");
      const data = await res.json();
      setResult(data);
      toast.success(`Scanned ${data.totalPromotions} promotions, ${data.flaggedPromotions.length} flagged`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Promo Audit
        </h1>
        <p className="text-muted-foreground mt-1">
          Detect retail promotions missing wholesale customer group exclusions.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button onClick={runAudit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Run Promo Audit
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium">Total Promotions</p>
                <p className="text-3xl font-bold mt-1">{result.totalPromotions}</p>
              </CardContent>
            </Card>
            <Card className={result.flaggedPromotions.length > 0 ? "border-danger/30" : "border-success/30"}>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium">Flagged</p>
                <p className={`text-3xl font-bold mt-1 ${result.flaggedPromotions.length > 0 ? "text-danger" : "text-success"}`}>
                  {result.flaggedPromotions.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {result.flaggedPromotions.length === 0 ? (
            <Card className="border-success/30 bg-success-light/30">
              <CardContent className="py-8 text-center flex flex-col items-center gap-2">
                <CheckCircle className="h-8 w-8 text-success" />
                <p className="text-sm text-success font-medium">
                  All promotions properly configured. No missing exclusions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {result.flaggedPromotions.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono">#{p.id}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
