"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";

export function RecalcTierButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    newTier: string;
    count7d: number;
    changed: boolean;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleRecalc() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/recalc-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to recalculate");
      }

      const data = await res.json();
      setResult({
        newTier: data.newTier,
        count7d: data.count7d,
        changed: data.changed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recalculate tier");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRecalc}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-3 w-3" />
        )}
        Recalculate Tier Now
      </Button>
      {result && (
        <div className="rounded-md bg-muted p-2 text-xs space-y-0.5">
          <p className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Tier: <strong>{result.newTier}</strong> ({result.count7d} qualifying orders)
          </p>
          {result.changed && (
            <p className="text-primary font-medium">Tier was updated!</p>
          )}
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
