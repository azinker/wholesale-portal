import Link from "next/link";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_API_VERSION, SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { CHANNEL_TERMS_TEXT, CHANNEL_TERMS_TITLE, CHANNEL_TERMS_UPDATED } from "@/lib/shopify-channel/terms";
import { shopifyAppConfigured } from "@/lib/shopify-channel/shopify-admin";
import { env } from "@/lib/env";
import { TermsAccept } from "./terms-accept";
import { CopyUrl } from "./copy-url";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  SetupTrack,
  StatusPill,
  statusLabel,
  channelField,
  channelGhostBtn,
  channelPrimaryBtn,
} from "../channel-ui";

export default async function MyShopifyPage() {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const canConnect = userHasPermission(user, "manage_channel_billing");
  const [terms, card, connections] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId: account.id, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    }),
    db.sellerPaymentMethod.findUnique({ where: { accountId: account.id } }),
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
  const liveStores = connections.filter((row) => !row.disconnectedAt);
  const passed = liveStores.some((row) => row.addressTestStatus === "PASSED");

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify channel"
        title="My Shopify"
        lede="Connect up to five USD stores. Add stays off until the terms, a credit card, and a passed address test are done."
      >
        {preview && (
          <form action="/api/portal/shopify-channel/preview" method="post">
            <button className={channelGhostBtn} type="submit">Create a sample order</button>
          </form>
        )}
      </ChannelHeading>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Preview. The channel is off for other wholesalers. A sample order does not charge a credit card and does not create a warehouse order.
        </ChannelPanel>
      )}

      <SetupTrack
        steps={[
          {
            title: "Accept the terms",
            detail: terms ? "Accepted" : "Scroll the agreement and agree",
            done: Boolean(terms),
            href: "#terms",
          },
          {
            title: "Save a credit card",
            detail: card ? `${card.brand} ending ${card.last4}` : "The credit card we charge for each paid Shopify order",
            done: Boolean(card),
            href: "/billing",
          },
          {
            title: "Connect and test",
            detail: passed ? "Address test passed" : "Connect the store, then send a test webhook",
            done: passed,
            href: "#connect",
          },
        ]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <ChannelPanel className="p-5 md:p-6" delay={80}>
          <div id="terms">
            <h2 className="font-display text-xl font-semibold">{CHANNEL_TERMS_TITLE}</h2>
            <p className="mt-1 text-xs text-[#5c5654]">Last updated {CHANNEL_TERMS_UPDATED}. Version {SHOPIFY_CHANNEL_TERMS_VERSION}.</p>
            <div className="mt-4">
              {terms ? (
                <p className="text-sm text-[#1a1a1a]">Accepted {terms.acceptedAt.toLocaleString()}.</p>
              ) : (
                <TermsAccept text={CHANNEL_TERMS_TEXT} canAccept={canConnect} />
              )}
            </div>
          </div>
        </ChannelPanel>

        <ChannelPanel className="p-5 md:p-6" delay={140}>
          <h2 className="font-display text-xl font-semibold">What you do next</h2>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-[#3f3a38]">
            <li><span className="font-semibold text-[#1a1a1a]">1. Agree.</span> An owner or admin scrolls the terms and agrees.</li>
            <li><span className="font-semibold text-[#1a1a1a]">2. Save a credit card.</span> On Billing. This is the credit card we charge. It is not store credit. We store the brand and last four digits only.</li>
            <li><span className="font-semibold text-[#1a1a1a]">3. Connect the store</span> and follow the six steps on the store card. They say where to click and what to type.</li>
            <li><span className="font-semibold text-[#1a1a1a]">4. Open Catalog</span> and add products. One email arrives when the add finishes.</li>
          </ol>
          <Link href="/billing" className={`${channelPrimaryBtn} mt-5`}>
            {card ? "Review the credit card" : "Save a credit card"}
          </Link>
        </ChannelPanel>
      </div>

      <div id="connect" className="space-y-4">
        {connections.map((connection, index) => {
          const webhookUrl = `${appUrl}/api/shopify/channel/webhook/${connection.id}/${connection.webhookToken}`;
          const sample = connection.shopDomain.startsWith("preview-");
          const testTone = connection.addressTestStatus === "PASSED" ? "good" : connection.addressTestStatus === "FAILED" ? "bad" : "wait";
          const testLabel = connection.addressTestStatus === "PASSED" ? "Address test passed" : connection.addressTestStatus === "FAILED" ? "Address test failed" : "Waiting for the test";
          return (
            <ChannelPanel key={connection.id} className="p-5 md:p-6" delay={index * 40}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{sample ? "Sample" : "Store"}</p>
                  <h2 className="font-display text-2xl font-semibold">{sample ? "Sample store" : connection.shopDomain}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={testTone}>{testLabel}</StatusPill>
                  {connection.disconnectedAt ? (
                    <StatusPill tone="neutral">Disconnected</StatusPill>
                  ) : connection.paused ? (
                    <StatusPill tone="wait">Paused</StatusPill>
                  ) : preview ? (
                    <StatusPill tone="neutral">Preview</StatusPill>
                  ) : (
                    <StatusPill tone="good">Taking orders</StatusPill>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="text-xs text-[#5c5654]">Listings</p>
                  <p className="font-display text-2xl font-semibold">{connection._count.listings}</p>
                </div>
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="text-xs text-[#5c5654]">Last stock sync</p>
                  <p className="mt-1 text-sm font-semibold">{connection.listings[0] ? connection.listings[0].updatedAt.toLocaleString() : "Not yet"}</p>
                </div>
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="text-xs text-[#5c5654]">Recent orders</p>
                  <p className="font-display text-2xl font-semibold">{connection.orders.length}</p>
                </div>
              </div>

              {connection.disconnectedAt ? (
                <p className="mt-4 text-sm leading-6 text-[#5c5654]">
                  Disconnected. New sales and stock updates are stopped. Products already on Shopify stay there. Reconnect this same store to resume.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold text-[#1a1a1a]">Address test</p>
                  {connection.addressTestStatus === "PASSED" ? (
                    <p className="text-sm leading-6 text-[#5c5654]">
                      This store passed. The two webhooks are in place. You do not need to add them again.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-[#5c5654]">
                        Shopify has to prove it can send this store’s ship-to address. Do these steps once.
                      </p>
                      <ol className="space-y-3 text-sm leading-6 text-[#3f3a38]">
                        <li><span className="font-semibold text-[#1a1a1a]">1. Find Webhooks.</span> In the Shopify admin, click Settings at the bottom left. Click Notifications. Scroll to the bottom and click Webhooks.</li>
                        <li><span className="font-semibold text-[#1a1a1a]">2. Copy the address.</span> Use the Copy button below. Paste that address into both webhooks.</li>
                        <li>
                          <span className="font-semibold text-[#1a1a1a]">3. Create webhook one.</span> Click Create webhook and set each field to this:
                          <span className="mt-1 block">Event: Order payment. Format: JSON. URL: the copied address. Webhook API version: {SHOPIFY_API_VERSION}. Click Save.</span>
                        </li>
                        <li>
                          <span className="font-semibold text-[#1a1a1a]">4. Create webhook two.</span> Click Create webhook again and set each field to this:
                          <span className="mt-1 block">Event: Order update. Format: JSON. URL: the same address. Webhook API version: {SHOPIFY_API_VERSION}. Click Save.</span>
                        </li>
                        <li><span className="font-semibold text-[#1a1a1a]">5. Test each one.</span> On the Order payment row, click the three dots on the right, then Send test. Do the same on the Order update row.</li>
                        <li><span className="font-semibold text-[#1a1a1a]">6. Refresh this page.</span> The label changes to Address test passed when the test arrives.</li>
                      </ol>
                      <CopyUrl value={webhookUrl} />
                    </>
                  )}
                </div>
              )}

              {connection.orders.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#efeae7]">
                  {connection.orders.map((order) => (
                    <a key={order.id} href={`/my-shopify/orders/${order.id}`} className="flex cursor-pointer items-center justify-between gap-3 border-t border-[#f3eeeb] px-4 py-3 text-sm first:border-t-0 transition-colors duration-200 hover:bg-[#faf7f6]">
                      <span className="font-semibold">{order.shopifyOrderName}</span>
                      <span className="text-[#5c5654]">
                        {statusLabel(order.status)}
                        {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {canConnect && !connection.disconnectedAt && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action="/api/portal/shopify-channel/pause" method="post">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <input type="hidden" name="paused" value={connection.paused ? "false" : "true"} />
                    <button className={channelGhostBtn} type="submit" title="Pause before a vacation so new sales are not charged or shipped. Listings stay up.">
                      {connection.paused ? "Resume new orders" : "Pause new orders"}
                    </button>
                  </form>
                  <form action="/api/portal/shopify-channel/disconnect" method="post">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <button className={channelGhostBtn} type="submit" title="Disconnect one store. New sales stop and stock stops updating. Products already on that Shopify store stay there.">
                      Disconnect
                    </button>
                  </form>
                </div>
              )}

              {connection.addressTestStatus !== "PASSED" && canConnect && !connection.disconnectedAt && (
                <details className="mt-4 rounded-xl border border-[#efeae7] p-4 text-sm">
                  <summary className="cursor-pointer font-semibold">The test stayed red? Use a custom app token instead.</summary>
                  <p className="mt-2 leading-6 text-[#5c5654]">
                    In that Shopify admin, create a custom app, turn on read orders, install it, and paste the Admin API token with one order id.
                  </p>
                  <form action="/api/portal/shopify-channel/token" method="post" className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <input name="token" type="password" placeholder="Admin API token" className={channelField} aria-label="Admin API token" />
                    <input name="orderId" placeholder="An order id to test" className={channelField} aria-label="Order id" />
                    <button className={channelPrimaryBtn} type="submit">Test token</button>
                  </form>
                </details>
              )}
            </ChannelPanel>
          );
        })}

        {canConnect && shopifyAppConfigured() && liveStores.length < 5 && (
          <ChannelPanel className="p-5 md:p-6">
            <h2 className="font-display text-xl font-semibold">Connect a store</h2>
            <p className="mt-1 text-sm text-[#5c5654]">Use the myshopify.com address. Example: north-auto.myshopify.com. USD stores only.</p>
            <form action="/api/shopify/channel/connect" method="get" className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="shop">Store domain</label>
              <input id="shop" name="shop" placeholder="your-store.myshopify.com" className={channelField} />
              <button className={channelPrimaryBtn} type="submit">Connect Shopify</button>
            </form>
          </ChannelPanel>
        )}
        {canConnect && !shopifyAppConfigured() && (
          <p className="text-sm text-[#5c5654]">Shopify connect is not configured yet.</p>
        )}
      </div>
    </ChannelPage>
  );
}
