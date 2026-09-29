"use client";

import { Info } from "lucide-react";

export function Tip({ text, tone = "light" }: { text: string; tone?: "light" | "dark" }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className={`inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border ${tone === "dark" ? "border-white/40 text-white" : "border-[#cfc8c4] text-[#5c5654]"}`}
      >
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-left text-xs font-medium normal-case leading-5 tracking-normal text-[#1a1a1a] shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
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
