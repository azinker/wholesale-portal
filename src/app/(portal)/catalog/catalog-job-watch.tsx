"use client";

import { useEffect, useState } from "react";
import { advanceCatalogJobs, isCatalogDialogOpen, jobProgress, readTrackedJobs, subscribeJobs } from "./catalog-jobs";

export function CatalogJobWatch() {
  const [jobs, setJobs] = useState(readTrackedJobs);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setJobs(readTrackedJobs());
      setDialogOpen(isCatalogDialogOpen());
    };
    refresh();
    const stop = subscribeJobs(refresh);
    const timer = window.setInterval(() => {
      void advanceCatalogJobs();
    }, 2000);
    void advanceCatalogJobs();
    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, []);

  if (dialogOpen || jobs.length === 0) return null;
  const progress = jobProgress(jobs);
  const width = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 8;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] rounded-2xl border border-[#e7e1de] bg-white p-4 shadow-[0_16px_40px_rgba(45,45,45,0.16)]">
      <p className="font-semibold text-[#1a1a1a]">Adding to your Shopify store</p>
      <p className="mt-1 text-sm text-[#5c5654]">
        {progress.done} of {progress.total || "…"}
        {progress.minutesLeft ? ` · about ${progress.minutesLeft} min left` : ""}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0ebe8]">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5c5654]">You can keep working. We'll email you when it finishes.</p>
    </div>
  );
}
