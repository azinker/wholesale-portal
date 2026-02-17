"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Eye } from "lucide-react";

export function ImpersonationBanner({ targetEmail }: { targetEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(targetEmail);

  // Fetch current email dynamically to avoid stale layout cache
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.email) setEmail(data.email); })
      .catch(() => {});
  }, []);

  async function handleReturn() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stop-impersonating", { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore admin session");
      const data = await res.json();
      router.push(data.redirectTo || "/admin");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="fixed top-3 right-3 z-[100] bg-slate-800/90 backdrop-blur-sm text-white text-xs font-medium py-2 px-3 rounded-full shadow-lg flex items-center gap-2">
      <Eye className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
      <span className="truncate max-w-[180px]">
        {email}
      </span>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleReturn}
        disabled={loading}
        className="ml-1 bg-white/15 hover:bg-white/25 text-white border-0 text-[11px] h-6 px-2 rounded-full"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowLeft className="h-3 w-3" />}
        Return
      </Button>
    </div>
  );
}
