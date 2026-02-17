"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

export function RemoveApplicantButton({
  accountId,
  companyName,
  email,
  variant = "outline",
  size = "sm",
  redirectTo = "/admin/applicants",
}: {
  accountId: string;
  companyName: string;
  email: string;
  variant?: "outline" | "destructive" | "ghost";
  size?: "sm" | "xs" | "default";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applicants/${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      toast.success("Applicant removed", {
        description: `${companyName} (${email}) has been completely removed.`,
      });
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error("Failed to remove applicant", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove Applicant
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <span className="block">
              Are you sure you want to permanently remove <strong className="text-foreground">{companyName}</strong> ({email})?
            </span>
            <span className="block text-destructive font-medium">
              This action cannot be undone. The following will be permanently deleted:
            </span>
            <ul className="list-disc ml-5 space-y-1 text-sm">
              <li>Their wholesale account and all application data</li>
              <li>All uploaded documents</li>
              <li>All promotion records and coupon codes</li>
              <li>All tier snapshots and order history</li>
              <li>All team members and info change requests</li>
              <li>Their portal login account</li>
            </ul>
            <span className="block text-sm">
              Any active BigCommerce promotions will be disabled. The person can re-apply or be manually re-added afterward.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
