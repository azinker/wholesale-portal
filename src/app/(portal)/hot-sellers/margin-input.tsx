"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface MarginInputProps {
  costPrice: number;
}

export function MarginInput({ costPrice }: MarginInputProps) {
  const [resellPrice, setResellPrice] = useState("");

  const resell = parseFloat(resellPrice);
  const isValid = !isNaN(resell) && resell > 0;
  const profit = isValid ? resell - costPrice : 0;
  const margin = isValid && resell > 0 ? ((resell - costPrice) / resell) * 100 : 0;

  const marginColor =
    margin >= 30
      ? "text-green-600"
      : margin >= 15
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Resell $</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={resellPrice}
          onChange={(e) => setResellPrice(e.target.value)}
          className="h-7 text-xs w-20"
        />
        {isValid && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={marginColor + " font-semibold"}>
              {margin.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              ${profit.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
