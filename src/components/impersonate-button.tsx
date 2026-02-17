"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogIn, Loader2 } from "lucide-react";

export function ImpersonateButton({
  userId,
  userEmail,
  size = "xs",
}: {
  userId: string;
  userEmail: string;
  size?: "xs" | "sm" | "default";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    if (!confirm(`Log in as ${userEmail}? You'll be redirected to their portal view.`)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Impersonation failed");
      }

      const data = await res.json();
      toast.success(`Logged in as ${userEmail}`);
      router.push(data.redirectTo || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to impersonate");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleImpersonate}
      disabled={loading}
      className="text-info border-info/30 hover:bg-info-light hover:text-info"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <LogIn className="h-3 w-3" />
      )}
      Login As
    </Button>
  );
}
