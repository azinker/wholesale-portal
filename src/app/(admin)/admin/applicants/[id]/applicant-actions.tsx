"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ApplicantActions({
  accountId,
  currentStatus,
}: {
  accountId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeny, setShowDeny] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  const handleApprove = async () => {
    if (!confirm("Approve this wholesale applicant? They will be assigned to the Wholesale customer group.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applicants/${accountId}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Approval failed");
      }
      toast.success("Applicant approved successfully");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      toast.error("Please provide a denial reason");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applicants/${accountId}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denyReason }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Denial failed");
      }
      toast.success("Applicant denied");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={handleApprove} disabled={loading} className="bg-success hover:bg-success/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Approve
          </Button>
          <Button variant="destructive" onClick={() => setShowDeny(!showDeny)} disabled={loading}>
            <XCircle className="h-4 w-4" />
            Deny
          </Button>
        </div>

        {showDeny && (
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-2">
              <Label htmlFor="denyReason">Denial Reason</Label>
              <Textarea
                id="denyReason"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Explain why this application is being denied..."
                rows={3}
              />
            </div>
            <Button variant="destructive" onClick={handleDeny} disabled={loading || !denyReason.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Denial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
