"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { publishAddedCount, watchAddedCount } from "./catalog-count";

export function CatalogTabs({ count, view }: { count: number; view: "browse" | "added" }) {
  const [live, setLive] = useState(count);

  useEffect(() => {
    setLive(count);
    publishAddedCount(count);
  }, [count]);

  useEffect(() => watchAddedCount(setLive), []);

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/catalog" className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "browse" ? "bg-[#2d2d2d] text-white" : "bg-white text-[#1a1a1a]"}`}>
        Browse catalog
      </Link>
      <Link href="/catalog?view=added" className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "added" ? "bg-[#2d2d2d] text-white" : "bg-white text-[#1a1a1a]"}`}>
        On your store ({live})
      </Link>
    </div>
  );
}
