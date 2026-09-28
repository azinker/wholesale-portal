import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { CHANNEL_TERMS_TEXT, CHANNEL_TERMS_TITLE, CHANNEL_TERMS_UPDATED } from "@/lib/shopify-channel/terms";
import { shopifyAppConfigured } from "@/lib/shopify-channel/shopify-admin";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { TermsAccept } from "./terms-accept";
import { ChannelSchemaNotice } from "../channel-schema-notice";

export default async function MyShopifyPage() {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const canConnect = userHasPermission(user, "manage_channel_billing");
  const [terms, connections] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId: account.id, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    }),
    db.shopifyConnection.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { listings: { where: { removedAt: null } } } },
        listings: { where: { removedAt: null }, orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
  ]);
  const appUrl = env().NEXT_PUBLIC_APP_URL;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Shopify</h1>
        <p className="text-muted-foreground mt-1">
          Connect up to five USD stores. Add stays off until the terms, a card, and a passed address test are done.
        </p>
      </div>
      {preview && (
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <p>Preview. The channel is off for other wholesalers, so a sale is saved and not charged.</p>
            <form action="/api/portal/shopify-channel/preview" method="post">
              <button className="rounded-md border px-3 py-2" type="submit">Create a sample order</button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h2 className="font-medium">{CHANNEL_TERMS_TITLE}</h2>
          <p className="text-xs text-muted-foreground">Last updated {CHANNEL_TERMS_UPDATED}. Version {SHOPIFY_CHANNEL_TERMS_VERSION}.</p>
          {terms ? (
            <p className="text-sm">Accepted {terms.acceptedAt.toLocaleString()}.</p>
          ) : (
            <TermsAccept text={CHANNEL_TERMS_TEXT} canAccept={canConnect} />
          )}
        </CardContent>
      </Card>

      {connections.map((connection) => {
        const webhookUrl = `${appUrl}/api/shopify/channel/webhook/${connection.id}/${connection.webhookToken}`;
        return (
          <Card key={connection.id}>
            <CardContent className="pt-6 space-y-2 text-sm">
              <p className="font-medium">{connection.shopDomain.startsWith("preview-") ? "Sample store" : connection.shopDomain}</p>
              {connection.disconnectedAt && <p>Disconnected. New sales and stock updates are stopped. Products already on Shopify stay there.</p>}
              <p>Address test: {connection.addressTestStatus.toLowerCase()}</p>
              <p>Listings: {connection._count.listings}</p>
              <p>Last stock sync: {connection.listings[0] ? connection.listings[0].updatedAt.toLocaleString() : "Not yet"}</p>
              <p>{connection.paused ? "New orders are paused. We will not charge or ship them." : "New orders are live."}</p>
              {connection.orders.map((order) => (
                <p key={order.id}>
                  <a className="underline" href={`/my-shopify/orders/${order.id}`}>{order.shopifyOrderName}</a>
                  {" "}{order.status.replaceAll("_", " ").toLowerCase()}
                  {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                </p>
              ))}
              {!connection.disconnectedAt && <p>Webhook URL</p>}
              {!connection.disconnectedAt && <code className="block break-all rounded bg-muted p-2 text-xs">{webhookUrl}</code>}
              {!connection.disconnectedAt && <ol className="list-decimal pl-5 space-y-1">
                <li>In Shopify admin, open Settings, then Notifications, then Webhooks.</li>
                <li>Create a webhook for Order payment. Format JSON. Paste the URL above.</li>
                <li>Create a second webhook on the same URL for Order updated.</li>
                <li>Click Send test notification, then come back here. Green means we received a name and street.</li>
              </ol>}
              {canConnect && !connection.disconnectedAt && (
                <form action="/api/portal/shopify-channel/pause" method="post">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <input type="hidden" name="paused" value={connection.paused ? "false" : "true"} />
                  <button className="rounded-md border px-3 py-2" type="submit" title="Example: pause before a vacation so new sales are not charged or shipped. Listings stay up.">
                    {connection.paused ? "Resume new orders" : "Pause new orders"}
                  </button>
                </form>
              )}
              {canConnect && !connection.disconnectedAt && (
                <form action="/api/portal/shopify-channel/disconnect" method="post">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <button className="rounded-md border px-3 py-2" type="submit" title="Example: disconnect one store. New sales stop and stock stops updating. Products already on that Shopify store stay there.">
                    Disconnect
                  </button>
                </form>
              )}
              {connection.addressTestStatus !== "PASSED" && canConnect && (
                <form action="/api/portal/shopify-channel/token" method="post" className="space-y-2">
                  <p>If the test stays red, create a custom app in that Shopify admin, turn on read orders, install it, and paste the Admin API token.</p>
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <input name="token" type="password" placeholder="Admin API token" className="w-full rounded-md border px-3 py-2" />
                  <input name="orderId" placeholder="An order id to test" className="w-full rounded-md border px-3 py-2" />
                  <button className="rounded-md border px-3 py-2" type="submit">Test token</button>
                </form>
              )}
            </CardContent>
          </Card>
        );
      })}

      {canConnect && shopifyAppConfigured() && connections.filter((row) => !row.disconnectedAt).length < 5 && (
        <Card>
          <CardContent className="pt-6">
            <form action="/api/shopify/channel/connect" method="get" className="space-y-2">
              <label className="text-sm block">Store domain</label>
              <input name="shop" placeholder="your-store.myshopify.com" className="w-full rounded-md border px-3 py-2 text-sm" />
              <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">
                Connect Shopify
              </button>
            </form>
          </CardContent>
        </Card>
      )}
      {canConnect && !shopifyAppConfigured() && (
        <p className="text-sm text-muted-foreground">Shopify connect is not configured yet.</p>
      )}
    </div>
  );
}
