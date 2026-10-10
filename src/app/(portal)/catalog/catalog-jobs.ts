"use client";

import { toast } from "sonner";

export type TrackedJob = {
  id: string;
  total: number;
  started: number;
  done: number;
  status: string;
  current: string;
};

const KEY = "tpp-catalog-jobs";
const listeners = new Set<() => void>();
let dialogOpen = false;
let ticking = false;

export function readTrackedJobs(): TrackedJob[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(jobs: TrackedJob[]) {
  sessionStorage.setItem(KEY, JSON.stringify(jobs));
  listeners.forEach((listener) => listener());
}

export function subscribeJobs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCatalogDialogOpen(open: boolean) {
  dialogOpen = open;
  listeners.forEach((listener) => listener());
}

export function isCatalogDialogOpen(): boolean {
  return dialogOpen;
}

export function trackCatalogJobs(ids: string[], total: number) {
  const jobs = readTrackedJobs();
  const now = Date.now();
  for (const id of ids) {
    if (!jobs.some((job) => job.id === id)) {
      jobs.push({ id, total, started: now, done: 0, status: "QUEUED", current: "" });
    }
  }
  write(jobs);
}

export async function advanceCatalogJobs() {
  if (ticking) return;
  const jobs = readTrackedJobs().filter((job) => job.status !== "COMPLETED" && job.status !== "FAILED");
  if (jobs.length === 0) return;
  ticking = true;
  try {
    const next = jobs.slice();
    for (let index = 0; index < next.length; index++) {
      const job = next[index];
      const res = await fetch(`/api/portal/shopify-channel/listings/jobs/${job.id}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        next[index] = { ...job, status: "FAILED", current: body.error || "The add stopped" };
        toast.error(body.error || "Adding to Shopify stopped. We emailed you if any products went through.");
        continue;
      }
      next[index] = {
        ...job,
        status: body.status || job.status,
        done: body.done || 0,
        total: body.total || job.total,
        current: body.current || "",
      };
      if (body.status === "COMPLETED" || body.status === "FAILED") {
        const added = body.addedCount || 0;
        const failed = body.failedCount || 0;
        toast.success(
          failed
            ? `Added ${added}. ${failed} could not be added. We emailed the details.`
            : `Added ${added} product${added === 1 ? "" : "s"} to your store. We emailed the details.`
        );
      }
    }
    write(next.filter((job) => job.status !== "COMPLETED" && job.status !== "FAILED"));
  } finally {
    ticking = false;
  }
}

export function jobProgress(jobs: TrackedJob[]): { done: number; total: number; minutesLeft: number | null; current: string } {
  const total = jobs.reduce((sum, job) => sum + (job.total || 0), 0);
  const done = jobs.reduce((sum, job) => sum + (job.done || 0), 0);
  const started = jobs.reduce((min, job) => Math.min(min, job.started), Date.now());
  const elapsed = Date.now() - started;
  const minutesLeft = done > 0 && total > done ? Math.max(1, Math.ceil(((elapsed / done) * (total - done)) / 60000)) : null;
  return { done, total, minutesLeft, current: jobs.find((job) => job.current)?.current || "" };
}
