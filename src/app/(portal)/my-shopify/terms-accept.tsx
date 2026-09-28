"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { channelPrimaryBtn } from "../channel-ui";

export function TermsAccept({ text, canAccept }: { text: string; canAccept: boolean }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(8);
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
      <div className="overflow-hidden rounded-xl border border-[#e4ddd9]">
        <div className="h-1 bg-[#f0ebe8]">
          <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <div
          className="h-72 overflow-y-auto bg-[#fbfaf9] p-4 text-sm leading-6 whitespace-pre-wrap text-[#1a1a1a] md:h-80"
          onScroll={(event) => {
            const el = event.currentTarget;
            const total = el.scrollHeight - el.clientHeight;
            const ratio = total <= 0 ? 1 : el.scrollTop / total;
            setProgress(Math.max(8, Math.min(100, Math.round(ratio * 100))));
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
          }}
        >
          {text}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#5c5654]">
          {scrolled ? "You have read to the end." : "Scroll to the end to turn on I agree."}
        </p>
        <button type="button" disabled={!canAccept || !scrolled || pending} onClick={accept} className={channelPrimaryBtn}>
          {pending ? "Saving…" : canAccept ? "I agree" : "An owner or admin must accept"}
        </button>
      </div>
    </div>
  );
}
