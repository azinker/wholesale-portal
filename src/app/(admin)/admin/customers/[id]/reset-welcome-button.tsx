"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Gift, Loader2, CheckCircle, XCircle } from "lucide-react";

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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newExpiry, setNewExpiry] = useState<string | null>(null);
  const [removedResult, setRemovedResult] = useState<{
    newTier: string;
    count7d: number;
    windowDays: number;
  } | null>(null);
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
    setRemovedResult(null);

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
      router.refresh();
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

  async function handleRemove() {
    const confirmed = confirm(
      `Remove welcome bonus for ${companyName} now?\n\n` +
        `This will immediately end welcome discount eligibility and recalculate tier based on current rolling order volume.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess(false);
    setNewExpiry(null);
    setRemovedResult(null);

    try {
      const res = await fetch("/api/admin/remove-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove welcome bonus");
      }
      setRemovedResult({
        newTier: data.newTier,
        count7d: data.count7d,
        windowDays: data.windowDays,
      });
      router.refresh();
      setTimeout(() => {
        setRemovedResult(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove welcome bonus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={loading}
          className="flex-1"
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleRemove}
          disabled={loading}
          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          {loading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-3 w-3" />
          )}
          Remove Welcome Bonus
        </Button>
      </div>
      {success && newExpiry && (
        <p className="text-xs text-green-600">
          New expiry: {new Date(newExpiry).toLocaleString()}
        </p>
      )}
      {removedResult && (
        <p className="text-xs text-green-600">
          Welcome removed. Tier is now <strong>{removedResult.newTier}</strong> ({removedResult.count7d} qualifying orders / {removedResult.windowDays}d).
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
