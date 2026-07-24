"use client";

import Link from "next/link";
import { Package, Megaphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function PartnerPathDialog({ open, onOpenChange }: PartnerPathDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden border-border/80">
        <DialogHeader className="px-6 pt-6 pb-4 text-left space-y-2 pr-12">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary">
            Choose your path
          </p>
          <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight">
            How do you want to grow with The Perfect Part?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Buy at wholesale for your resale business, or promote products to your
            audience and earn through AWIN.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 px-6 pb-6">
          <Link
            href="/apply/reseller"
            onClick={() => onOpenChange(false)}
            className="group rounded-xl border border-border bg-secondary/40 p-5 transition-all hover:border-primary/50 hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors">
              Resell &amp; fulfill
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Buy at tiered wholesale prices and drop-ship to your customers. We
              handle packing and shipping.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground mb-5">
              <li>Discounts up to 30%</li>
              <li>20% welcome offer for 72 hours</li>
              <li>Reseller ordering tools</li>
            </ul>
            <Button className="w-full gap-2">
              Apply as a reseller
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <Link
            href="/apply/publisher"
            onClick={() => onOpenChange(false)}
            className="group rounded-xl border border-border bg-secondary/40 p-5 transition-all hover:border-primary/50 hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors">
              Promote to your audience
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Share AWIN tracking links and earn commission when your audience
              buys. No inventory required.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground mb-5">
              <li>15% audience discount from approval</li>
              <li>Grow to 20% and 25% by volume</li>
              <li>Built for creators &amp; deal sites</li>
            </ul>
            <Button className="w-full gap-2">
              Apply as a publisher
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
