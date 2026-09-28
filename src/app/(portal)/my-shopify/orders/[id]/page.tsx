import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelSchemaNotice } from "../../../channel-schema-notice";

type Line = { title?: string; quantity?: number; salePrice?: number; unitCost?: number; lineCost?: number };
type Ship = {
  name?: string;
  street?: string;
  street2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
};

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function ChannelOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { account, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const { id } = await params;
  const order = await db.channelOrder.findFirst({
    where: { id, accountId: account.id },
    include: { connection: true },
  });
  if (!order) notFound();
  const lines = Array.isArray(order.lines) ? (order.lines as Line[]) : [];
  const ship = (order.shipTo || {}) as Ship;
  const sold = Number(order.soldFor);
  const charged = Number(order.amountCharged);
  const refunded = Number(order.amountRefunded);
  const net = charged - refunded;
  const goods = lines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const preview = order.shopifyOrderId === "preview";
  const adminUrl = preview
    ? null
    : `https://${order.connection.shopDomain}/admin/orders/${order.shopifyOrderId}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{order.connection.shopDomain}</p>
        <h1 className="text-2xl font-bold">{order.shopifyOrderName}</h1>
        <p className="text-sm text-muted-foreground">{order.createdAt.toLocaleString()}</p>
      </div>
      {preview && (
        <Card>
          <CardContent className="pt-6 text-sm">
            Sample order. No card was charged and nothing was sent to a warehouse.
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          {adminUrl && (
            <p>
              <a className="underline" href={adminUrl} target="_blank" rel="noreferrer">
                Open in Shopify admin
              </a>
            </p>
          )}
          <p>Status: {order.status.replaceAll("_", " ").toLowerCase()}</p>
          <p>Tier that day: {order.tier || "—"}</p>
          <p>Buyer: {ship.name || "—"}</p>
          <p>
            Ship to: {[ship.street, ship.street2, ship.city, ship.province, ship.zip, ship.country].filter(Boolean).join(", ") || "—"}
          </p>
          <p>Phone: {ship.phone || "—"}</p>
          {order.checkoutNote && <p>Checkout note: {order.checkoutNote}</p>}
          {order.bcOrderId && <p>Fulfillment number: {order.bcOrderId}</p>}
          {order.trackingNumber && (
            <p>
              {order.carrier || "Carrier"}{" "}
              {order.trackingUrl ? (
                <a className="underline" href={order.trackingUrl} target="_blank" rel="noreferrer">
                  {order.trackingNumber}
                </a>
              ) : (
                order.trackingNumber
              )}
            </p>
          )}
          {order.attentionNote && <p>Needs attention: {order.attentionNote.replaceAll("_", " ")}</p>}
          <p>
            <Link className="underline" href={`/support?category=shopify_order_change&order=${encodeURIComponent(order.shopifyOrderName)}`}>
              Request a change
            </Link>
          </p>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {lines.map((line, index) => {
          const qty = Number(line.quantity || 0);
          const sale = Number(line.salePrice || 0) * qty;
          const cost = Number(line.lineCost || 0);
          return (
            <Card key={`${line.title}-${index}`}>
              <CardContent className="pt-6 text-sm space-y-1">
                <p className="font-medium">{line.title}</p>
                <p>Quantity {qty}</p>
                <p>Sale price {money(sale)}</p>
                <p>Our cost {money(Number(line.unitCost || 0))} each, {money(cost)} for the line</p>
                <p>Margin {money(sale - cost)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardContent className="pt-6 text-sm space-y-1">
          <p>Buyer paid {money(sold)}</p>
          <p>Our product cost {money(goods || Number(order.goodsCharged))}</p>
          <p>Shipping we charged {money(Number(order.shippingCharged))}</p>
          <p>Total we charged {money(net)}</p>
          {refunded > 0 && <p>Refunded {money(refunded)}</p>}
          <p>Margin {money(sold - net)} before Shopify fees, which we do not know.</p>
        </CardContent>
      </Card>
      <Link className="text-sm underline" href="/billing">Back to Billing</Link>
    </div>
  );
}
