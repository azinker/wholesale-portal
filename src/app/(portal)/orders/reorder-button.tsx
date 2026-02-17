"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";

export function ReorderButton({ orderId }: { orderId: number }) {
  const [loading, setLoading] = useState(false);

  const handleReorder = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.cartUrl) {
        window.open(data.cartUrl, "_blank");
      } else {
        alert(data.error || "Failed to create reorder link");
      }
    } catch {
      alert("Failed to reorder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReorder}
      disabled={loading}
      className="h-7 px-2 text-xs"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <RotateCcw className="h-3 w-3 mr-1" />
          Reorder
        </>
      )}
    </Button>
  );
}
