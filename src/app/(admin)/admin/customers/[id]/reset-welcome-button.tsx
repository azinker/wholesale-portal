"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Loader2, CheckCircle } from "lucide-react";

interface Props {
  accountId: string;
  companyName: string;
  welcomeExpiresAt: string | null; // ISO string or null
  welcomeHours: number;
}

export function ResetWelcomeButton({
  accountId,
  companyName,
  welcomeExpiresAt,
  welcomeHours,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newExpiry, setNewExpiry] = useState<string | null>(null);
  const [error, setError] = useState("");

  const hasActiveWelcome =
    welcomeExpiresAt && new Date(welcomeExpiresAt) > new Date();

  const days = Math.round(welcomeHours / 24);
  const durationLabel = days >= 1 ? `${days} day${days !== 1 ? "s" : ""}` : `${welcomeHours} hours`;

  async function handleReset() {
    const currentStatus = hasActiveWelcome
      ? `currently active until ${new Date(welcomeExpiresAt!).toLocaleString()}`
      : welcomeExpiresAt
      ? "already expired"
      : "never applied";

    const confirmed = confirm(
      `Reset the welcome bonus for ${companyName}?\n\n` +
        `Current status: ${currentStatus}\n` +
        `This will grant a fresh ${durationLabel} welcome discount window starting from now.\n\n` +
        `The tier will recalculate immediately.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/reset-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset welcome bonus");
      }

      setNewExpiry(data.newExpiry);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setNewExpiry(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset welcome bonus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : success ? (
          <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
        ) : (
          <Gift className="mr-2 h-3 w-3" />
        )}
        {success ? "Welcome Bonus Reset!" : "Reset Welcome Bonus"}
      </Button>
      {success && newExpiry && (
        <p className="text-xs text-green-600">
          New expiry: {new Date(newExpiry).toLocaleString()}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
