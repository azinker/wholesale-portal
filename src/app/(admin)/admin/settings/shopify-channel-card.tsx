"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type QueueOrder = {
  id: string;
  company: string;
  name: string;
  status: string;
  shop: string;
  amount: string;
  note: string | null;
  error: string | null;
  stripeChargeId: string | null;
  bcOrderId: number | null;
};

export function ShopifyChannelCard() {
  const [enabled, setEnabled] = useState(false);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/shopify-channel");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEnabled(Boolean(data.enabled));
        setOrders(data.orders || []);
      } catch {
        toast.error("Could not load the Shopify channel");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refund(orderId: string) {
    const typed = window.prompt("Refund amount in dollars", orders.find((row) => row.id === orderId)?.amount || "");
    if (typed == null) return;
    const amount = Number(typed);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a dollar amount");
      return;
    }
    const res = await fetch("/api/admin/shopify-channel/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount, cancelWarehouse: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Refund failed");
      return;
    }
    toast.success("Refund sent");
  }

  async function toggle(next: boolean) {
    const res = await fetch("/api/admin/shopify-channel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not update the channel");
      return;
    }
    setEnabled(Boolean(data.enabled));
    toast.success(next ? "Shopify channel is on" : "Shopify channel is off");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify channel</CardTitle>
        <CardDescription>
          Leave this off until you have tested it. Off keeps Hot Sellers for current wholesalers.
          To preview, sign in as an approved dropshipper on the admin allowlist, or impersonate one, then open My Shopify and create a sample order.
          Turning this on shows Catalog, Billing, and My Shopify to every approved dropshipper and charges saved paid orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} disabled={loading} onCheckedChange={toggle} />
          <span className="text-sm">{enabled ? "On for approved dropshippers" : "Off"}</span>
        </div>
        {orders.length > 0 && (
          <ul className="space-y-2 text-sm">
            {orders.map((order) => (
              <li key={order.id}>
                {order.company} {order.name} on {order.shop}: {order.status}
                {order.note ? ` (${order.note})` : ""}
                {order.stripeChargeId ? ` Stripe ${order.stripeChargeId}` : ""}
                {order.bcOrderId ? ` Warehouse ${order.bcOrderId}` : ""}
                {order.stripeChargeId && (
                  <button className="ml-2 underline" type="button" onClick={() => refund(order.id)}>
                    Refund
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
