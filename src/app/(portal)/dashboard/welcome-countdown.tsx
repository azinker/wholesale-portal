"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

function getTimeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, total: diff };
}

export function WelcomeCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(getTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getTimeRemaining(expiresAt);
      setRemaining(r);
      if (!r) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!remaining) {
    return (
      <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
        Welcome period ended — your tier discount is now based on order volume
      </Badge>
    );
  }

  const days = Math.floor(remaining.hours / 24);
  const hrs = remaining.hours % 24;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-purple-600 font-medium">Expires in:</span>
      <div className="flex items-center gap-1.5">
        {days > 0 && (
          <div className="bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center min-w-[44px]">
            <span className="text-sm font-bold text-purple-700">{days}</span>
            <span className="text-[9px] text-purple-500 block -mt-0.5">day{days !== 1 ? "s" : ""}</span>
          </div>
        )}
        <div className="bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center min-w-[44px]">
          <span className="text-sm font-bold text-purple-700">{String(hrs).padStart(2, "0")}</span>
          <span className="text-[9px] text-purple-500 block -mt-0.5">hr</span>
        </div>
        <span className="text-purple-400 font-bold">:</span>
        <div className="bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center min-w-[44px]">
          <span className="text-sm font-bold text-purple-700">{String(remaining.minutes).padStart(2, "0")}</span>
          <span className="text-[9px] text-purple-500 block -mt-0.5">min</span>
        </div>
        <span className="text-purple-400 font-bold">:</span>
        <div className="bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center min-w-[44px]">
          <span className="text-sm font-bold text-purple-700">{String(remaining.seconds).padStart(2, "0")}</span>
          <span className="text-[9px] text-purple-500 block -mt-0.5">sec</span>
        </div>
      </div>
    </div>
  );
}
