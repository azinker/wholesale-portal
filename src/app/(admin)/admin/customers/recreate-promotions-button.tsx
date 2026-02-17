"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function RecreatePromotionsButton() {
  const [loading, setLoading] = useState(false);

  async function handleRecreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recreate-promotions", { method: "POST" });
      if (!res.ok) throw new Error("Promotion recreation failed");
      const data = await res.json();
      toast.success("Promotions recreated", {
        description: `${data.processed} processed, ${data.recreated} recreated, ${data.errors} errors`,
      });
      // Reload page to show updated promotions
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Recreate All Promotions
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recreate All Promotions?</AlertDialogTitle>
          <AlertDialogDescription>
            This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Clear all existing promotion links from the database</li>
              <li>Create fresh promotions in BigCommerce with the correct rules</li>
              <li>Generate new coupon codes for all approved customers</li>
            </ul>
            <p className="mt-2 font-medium">
              Use this if promotions were deleted in BigCommerce but still show in the portal.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecreate}>Recreate Promotions</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
