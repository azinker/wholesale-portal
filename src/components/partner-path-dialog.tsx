"use client";

import Link from "next/link";
import { Package, Megaphone, ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PartnerPathDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PATHS = [
  {
    href: "/apply/reseller",
    icon: Package,
    title: "Resell & fulfill",
    tagline: "For dropshippers and retailers",
    body: "Buy at tiered wholesale prices and let us ship straight to your customer.",
    points: ["10% to 30% off wholesale", "20% welcome pricing for 72 hours", "Portal ordering and reorder tools"],
    cta: "Apply as a reseller",
  },
  {
    href: "/apply/publisher",
    icon: Megaphone,
    title: "Promote & earn",
    tagline: "For creators and publishers",
    body: "Share AWIN links and a public discount code, and earn commission on every tracked sale.",
    points: ["15% audience discount from day one", "Grow to 20% and 25% by volume", "Built for blogs, creators, deal sites"],
    cta: "Apply as a publisher",
  },
];

export function PartnerPathDialog({ open, onOpenChange }: PartnerPathDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-2 border-b border-border bg-[#faf8f6] px-6 pb-5 pr-12 pt-6 text-left">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-[3px] w-[3px] bg-primary" />
            Choose your path
          </p>
          <DialogTitle className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-[1.7rem]">
            How do you want to grow?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Buy at wholesale for your resale business, or promote to your audience
            and earn through AWIN. Both take about two minutes to apply.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {PATHS.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              onClick={() => onOpenChange(false)}
              className="group flex flex-col rounded-xl border border-border bg-white p-5 transition-all hover:border-primary/40 hover:shadow-[0_12px_36px_rgba(26,26,26,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <path.icon className="h-5 w-5" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {path.tagline}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold tracking-tight">{path.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{path.body}</p>
              <ul className="mt-4 mb-5 space-y-2">
                {path.points.map((point) => (
                  <li key={point} className="flex gap-2 text-xs text-foreground/75">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {point}
                  </li>
                ))}
              </ul>
              <span className={buttonVariants({ className: "mt-auto w-full gap-2" })}>
                {path.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
