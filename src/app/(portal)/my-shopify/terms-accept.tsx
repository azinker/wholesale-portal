"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function TermsAccept({ text, canAccept }: { text: string; canAccept: boolean }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    try {
      const res = await fetch("/api/portal/shopify-channel/terms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save acceptance");
      toast.success("Terms accepted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save acceptance");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="h-64 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap"
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
        }}
      >
        {text}
      </div>
      <button
        type="button"
        disabled={!canAccept || !scrolled || pending}
        onClick={accept}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {canAccept ? "I agree" : "An owner or admin must accept"}
      </button>
      {!scrolled && <p className="text-xs text-muted-foreground">Scroll to the end to accept.</p>}
    </div>
  );
}
