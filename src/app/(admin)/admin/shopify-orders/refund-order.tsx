"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefundOrder({
  orderId,
  orderName,
  remaining,
  shipped,
}: {
  orderId: string;
  orderName: string;
  remaining: number;
  shipped: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [stopShipment, setStopShipment] = useState(!shipped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shopify-channel/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount: Number(amount),
          cancelWarehouse: stopShipment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  if (remaining <= 0) return <span className="text-xs text-[#5c5654]">Refunded</span>;

  return (
    <>
      <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setOpen(true)}>
        Refund
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-display text-xl font-semibold">Refund {orderName}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5c5654]">
              This sends money back to the dropshipper&apos;s card. It does not refund the customer who bought on their Shopify store. They refund that customer in Shopify.
              {shipped
                ? " The warehouse order will be marked Refunded."
                : " A full refund marks the warehouse order Cancelled."}
            </p>
            <label className="mt-4 block text-sm font-medium">
              Amount
              <input
                className="mt-1 w-full rounded-xl border border-[#e4ddd9] px-3 py-2"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={stopShipment} onChange={(event) => setStopShipment(event.target.checked)} disabled={shipped} />
              <span>{shipped ? "Already shipped, so the package can still be on the way." : "Also stop the shipment if this is only a partial refund."}</span>
            </label>
            {error && <p className="mt-3 text-sm text-[#9c2126]">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-4 py-2 text-sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={submit} disabled={busy}>
                {busy ? "Refunding…" : "Refund the card"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
