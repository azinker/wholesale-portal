"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

export default function RiskFlagActions({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const resolve = async (status: "CLEARED" | "KEPT") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/risk-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to resolve");
      }
      toast.success(`Flag ${status === "CLEARED" ? "cleared" : "kept"}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => resolve("CLEARED")} disabled={loading}
        className="border-success text-success hover:bg-success-light">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Clear (False Positive)
      </Button>
      <Button variant="outline" size="sm" onClick={() => resolve("KEPT")} disabled={loading}
        className="border-warning text-warning hover:bg-warning-light">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
        Keep (Confirmed Risk)
      </Button>
    </div>
  );
}
