"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function CopyCouponButton({ code, label = "Copy Code" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={`transition-all ${copied ? "bg-green-50 border-green-300 text-green-700" : ""}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1" />
          {label}
        </>
      )}
    </Button>
  );
}
