"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function InfoReviewActions({
  changeRequestId,
}: {
  changeRequestId: string;
}) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);

  async function handleAction(action: "approve" | "deny") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/business-info-changes/${changeRequestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote: reviewNote.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action}`);
      }

      toast.success(
        action === "approve"
          ? "Changes approved and applied to the account."
          : "Changes denied. The customer will be notified."
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Review Note (optional)</Label>
        <Textarea
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Add a note for the customer (e.g. reason for denial)..."
          rows={2}
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => handleAction("approve")}
          disabled={!!loading}
          size="sm"
          className="bg-success hover:bg-success/90"
        >
          {loading === "approve" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-1" />
          )}
          Approve Changes
        </Button>
        <Button
          onClick={() => handleAction("deny")}
          disabled={!!loading}
          size="sm"
          variant="destructive"
        >
          {loading === "deny" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4 mr-1" />
          )}
          Deny
        </Button>
      </div>
    </div>
  );
}
