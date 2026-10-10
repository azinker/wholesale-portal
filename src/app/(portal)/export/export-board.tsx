"use client";

import { useEffect, useState } from "react";
import { channelField, channelGhostBtn, channelPrimaryBtn } from "../channel-ui";

type Product = { id: number; name: string; price: number; image: string | null };
type Job = { id: string; status: string; total: number; done: number; error: string | null };

export function ExportBoard({ readyId }: { readyId?: string }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<Job | null>(readyId ? { id: readyId, status: "READY", total: 0, done: 0, error: null } : null);
  const [message, setMessage] = useState("");

  async function search(next = query) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/portal/catalog-export/search?q=${encodeURIComponent(next)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search("");
    // The first search is the catalog opening state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!job || job.status === "READY" || job.status === "FAILED") return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/portal/catalog-export/${job.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as Job;
      setJob(data);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function start(ids: number[]) {
    setMessage("");
    const res = await fetch("/api/portal/catalog-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: ids }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not start the export");
      if (data.id) setJob({ id: data.id, status: "RUNNING", total: 0, done: 0, error: null });
      return;
    }
    setJob({ id: data.id, status: "QUEUED", total: data.total, done: 0, error: null });
  }

  const progress = job && job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : job?.status === "READY" ? 100 : 8;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <input
          className={channelField + " max-w-md"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          aria-label="Search products"
        />
        <button className={channelGhostBtn} type="submit">Search</button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button className={channelPrimaryBtn} type="button" disabled={selected.length === 0 || job?.status === "RUNNING" || job?.status === "QUEUED"} onClick={() => start(selected)}>
          Export selected ({selected.length})
        </button>
        <button
          className={channelGhostBtn}
          type="button"
          disabled={products.length === 0 || job?.status === "RUNNING" || job?.status === "QUEUED"}
          onClick={() => start(products.map((product) => product.id))}
        >
          Export these results
        </button>
        <p className="text-xs text-[#5c5654]">{total > 0 ? `${total} products match. Each export can include up to 80.` : "Search the catalog, then export the ones you want."}</p>
      </div>

      {message && <p className="text-sm text-[#9c2126]">{message}</p>}

      {job && (
        <div className="rounded-2xl border border-[#e7e1de] bg-white px-5 py-4">
          <p className="text-sm font-semibold">
            {job.status === "READY" ? "Your file is ready" : job.status === "FAILED" ? "The export did not finish" : "Building your file"}
          </p>
          <p className="mt-1 text-sm text-[#5c5654]">
            {job.status === "READY"
              ? "We also emailed you. The zip has the spreadsheet, a how-to sheet, and the pictures."
              : job.status === "FAILED"
                ? job.error || "Try again with fewer products."
                : `${job.done} of ${job.total || "…"} products. You can leave this page. We'll email you when it is ready.`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0ebe8]">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${job.status === "FAILED" ? 100 : progress}%` }} />
          </div>
          {job.status === "READY" && (
            <a className={channelPrimaryBtn + " mt-4"} href={`/api/portal/catalog-export/${job.id}/download`}>
              Download zip
            </a>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white">
        {loading && products.length === 0 && <p className="px-5 py-8 text-sm text-[#5c5654]">Loading products…</p>}
        {products.map((product) => (
          <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f0ebe8] px-4 py-3 last:border-0 hover:bg-[#faf7f6]">
            <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
            {product.image ? (
              // Catalog thumbnails are remote BigCommerce images.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <span className="h-12 w-12 rounded-lg bg-[#f6f3f1]" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{product.name}</span>
              <span className="text-xs text-[#5c5654]">Retail ${product.price.toFixed(2)}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
