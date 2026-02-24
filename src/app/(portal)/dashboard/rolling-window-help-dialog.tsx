"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TierRange {
  label: string;
  min: number;
  max: number;
}

export function RollingWindowHelpDialog({
  tierWindowLabel,
  count,
  currentTierLabel,
  nextTierLabel,
  nextTierMin,
  ranges,
}: {
  tierWindowLabel: string;
  count: number;
  currentTierLabel: string;
  nextTierLabel: string | null;
  nextTierMin: number | null;
  ranges: TierRange[];
}) {
  const ordersToNext = nextTierMin != null ? Math.max(nextTierMin - count, 0) : 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto px-0 text-xs">
          Learn More
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How Rolling Tier Volume Works</DialogTitle>
          <DialogDescription>
            Simple explanation of how your order count affects your discount tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your tier is based on qualifying orders in a rolling <strong className="text-foreground">{tierWindowLabel}</strong> window.
            Every time a new order is placed, the window moves forward, and older orders eventually fall out.
          </p>

          <p>
            Right now, you have <strong className="text-foreground">{count}</strong> qualifying order{count === 1 ? "" : "s"} and your current tier is{" "}
            <strong className="text-foreground">{currentTierLabel}</strong>.
          </p>

          {nextTierLabel && nextTierMin != null ? (
            <p>
              To unlock <strong className="text-foreground">{nextTierLabel}</strong>, you need{" "}
              <strong className="text-foreground">{ordersToNext}</strong> more qualifying order{ordersToNext === 1 ? "" : "s"} in the current rolling window.
            </p>
          ) : (
            <p>
              You are already at the highest available tier. Keep consistent order volume each rolling window to maintain it.
            </p>
          )}

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium text-foreground mb-1">Example</p>
            <p>
              If your window is <strong className="text-foreground">{tierWindowLabel}</strong>, only orders from that recent period count. An order placed before that period no longer counts toward your tier.
            </p>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium text-foreground mb-1">Tier Thresholds</p>
            <ul className="space-y-1">
              {ranges.map((r) => (
                <li key={`${r.label}-${r.min}`} className="font-mono text-xs">
                  {r.label}: {r.min}-{r.max === Infinity ? "∞" : r.max} orders / {tierWindowLabel}
                </li>
              ))}
            </ul>
          </div>

          <p>
            If your qualifying count drops below a threshold, your tier can move down on recalculation. If your count goes up and crosses a threshold, your tier can move up.
          </p>

          <p>
            Need help understanding your numbers? Go to <Link href="/support" className="text-primary underline underline-offset-2">Support</Link> and contact an admin right away for clarification.
          </p>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
