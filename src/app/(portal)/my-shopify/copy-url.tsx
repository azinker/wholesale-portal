"use client";

import { useState } from "react";
import { toast } from "sonner";

export function CopyUrl({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy. Select the address and copy it yourself.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#f6f3f1] p-2">
      <code className="min-w-0 flex-1 truncate px-2 text-xs text-[#1a1a1a]">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer rounded-lg bg-[#2d2d2d] px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#1a1a1a]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
