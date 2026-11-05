export default function CatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4" role="status" aria-live="polite">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Shopify</p>
        <h1 className="font-display text-3xl font-semibold text-[#1a1a1a]">Catalog</h1>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-36 rounded-full bg-[#2d2d2d]" />
        <div className="h-9 w-40 rounded-full bg-white" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]">
        <div className="h-11 bg-[#2d2d2d]" />
        <div className="space-y-3 px-4 py-4">
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <p className="text-sm text-[#5c5654]">Loading products…</p>
        </div>
      </div>
    </div>
  );
}
