"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";

export default function TierRecalcButton() {
  const [loading, setLoading] = useState(false);

  async function handleRecalc() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tier-recalc", { method: "POST" });
      if (!res.ok) throw new Error("Recalculation failed");
      const data = await res.json();
      toast.success("Tier recalculation complete", {
        description: `${data.processed} processed, ${data.changed} changed, ${data.errors} errors`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRecalc} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Recalc All Tiers
    </Button>
  );
}
