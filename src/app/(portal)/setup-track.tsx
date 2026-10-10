"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tip } from "./tip";

export type SetupStep = {
  title: string;
  detail: string;
  done: boolean;
  href?: string;
  tip: string;
  terms?: { title: string; updated: string; acceptedAt: string; text: string };
};

export function SetupTrack({ steps, compact = false }: { steps: SetupStep[]; compact?: boolean }) {
  const [termsOpen, setTermsOpen] = useState(false);
  const terms = steps.find((step) => step.terms)?.terms;
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-3">
      {!compact && (
        <>
          <div className="flex items-center justify-between text-xs font-medium text-[#5c5654]">
            <span className="inline-flex items-center gap-1.5">
              Setup
              <Tip text="Three steps, then you can add products. When they're done, this row stays small." />
            </span>
            <span>
              {doneCount} of {steps.length} done
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e1de]">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </>
      )}
      <ol className="grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => {
          const inner = (
            <>
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  compact ? "h-7 w-7" : "h-9 w-9",
                  step.done ? "bg-emerald-600 text-white" : "bg-[#2d2d2d] text-white"
                )}
              >
                {step.done ? <Check size={compact ? 14 : 16} /> : index + 1}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold text-[#1a1a1a]">{step.title}</span>
                {!compact && <span className="block text-xs leading-5 text-[#5c5654]">{step.detail}</span>}
              </span>
            </>
          );
          return (
            <li key={step.title} className="channel-in" style={{ animationDelay: `${index * 70}ms` }}>
              <div
                className={cn(
                  "flex h-full items-center gap-3 rounded-2xl border bg-white shadow-sm",
                  compact ? "px-3 py-2.5" : "p-4",
                  step.done ? "border-emerald-200" : "border-[#e7e1de]"
                )}
              >
                {step.terms ? (
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                  >
                    {inner}
                  </button>
                ) : (
                  <a href={step.href || "#connect"} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    {inner}
                  </a>
                )}
                <Tip text={step.tip} />
              </div>
            </li>
          );
        })}
      </ol>
      {terms && (
        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{terms.title}</DialogTitle>
              <DialogDescription>
                Accepted {terms.acceptedAt}. Last updated {terms.updated}.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#3f3a38]">
              {terms.text}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
