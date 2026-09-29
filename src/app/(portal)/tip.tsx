"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function Tip({ text, tone = "light" }: { text: string; tone?: "light" | "dark" }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const button = buttonRef.current;
      const tip = tipRef.current;
      if (!button || !tip) return;
      const rect = button.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const margin = 8;
      let left = rect.left + rect.width / 2 - box.width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
      let top = rect.bottom + margin;
      if (top + box.height > window.innerHeight - margin) top = Math.max(margin, rect.top - margin - box.height);
      setPos({ top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, text]);

  return (
    <span className="inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border ${tone === "dark" ? "border-white/40 text-white" : "border-[#cfc8c4] text-[#5c5654]"}`}
      >
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, width: "16rem", zIndex: 80, visibility: pos ? "visible" : "hidden" }}
            className="pointer-events-none rounded-xl border border-[#e7e1de] bg-white px-3 py-2 text-left text-xs font-medium normal-case leading-5 tracking-normal text-[#1a1a1a] shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}

export function TipLabel({
  children,
  tip,
  tone = "light",
}: {
  children: React.ReactNode;
  tip: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <Tip text={tip} tone={tone} />
    </span>
  );
}
