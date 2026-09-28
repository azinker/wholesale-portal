"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CatalogAddButton({
  productId,
  disabled,
  reason,
}: {
  productId: number;
  disabled: boolean;
  reason?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    try {
      const res = await fetch("/api/portal/shopify-channel/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bcProductIds: [productId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      toast.success("Add started. We will email you when it finishes.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={add} disabled={disabled || pending} title={reason}>
      {pending ? "Adding…" : "Add"}
    </Button>
  );
}
