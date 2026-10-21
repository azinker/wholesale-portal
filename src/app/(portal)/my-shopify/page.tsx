import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_CHANNEL_TERMS_VERSION, SHOPIFY_CONNECT_MAINTENANCE } from "@/lib/shopify-channel/constants";
import { CHANNEL_TERMS_TEXT, CHANNEL_TERMS_TITLE, CHANNEL_TERMS_UPDATED } from "@/lib/shopify-channel/terms";
import { shopifyAppConfigured } from "@/lib/shopify-channel/shopify-admin";
import { TermsAccept } from "./terms-accept";
import { ShopifyGuideDialog } from "./shopify-guide-dialog";
import { Tip } from "../tip";
import { SetupTrack } from "../setup-track";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  StatusPill,
  statusLabel,
  channelField,
  channelGhostBtn,
  channelPrimaryBtn,
} from "../channel-ui";

export default async function MyShopifyPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  const query = await searchParams;
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
  const realConnections = connections.filter((row) => !row.shopDomain.startsWith("preview-"));
  const liveStores = realConnections.filter((row) => !row.disconnectedAt);
  const passed = liveStores.some((row) => row.addressTestStatus === "PASSED");
  const setupDone = Boolean(terms && card && passed);

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="My Shopify"
        lede="Connect a Shopify store, up to 5. Your customer pays you there. We charge your card and ship to them. For a spreadsheet instead, use Export listings."
      >
        <ShopifyGuideDialog />
      </ChannelHeading>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Only you can see this while we finish testing. Other wholesalers still use their regular dashboard.
        </ChannelPanel>
      )}

      <SetupTrack
        compact={setupDone}
        steps={[
          {
            title: terms ? "Terms accepted" : "Accept the terms",
            detail: terms ? `Accepted ${terms.acceptedAt.toLocaleString()}` : "Read the agreement, then agree",
            done: Boolean(terms),
            href: terms ? undefined : "#terms",
            tip: terms
              ? "Opens the terms you already accepted."
              : "An owner or admin reads the terms and agrees. Then you can connect a store.",
            terms: terms
              ? {
                  title: CHANNEL_TERMS_TITLE,
                  updated: `${CHANNEL_TERMS_UPDATED}. Version ${SHOPIFY_CHANNEL_TERMS_VERSION}`,
                  acceptedAt: terms.acceptedAt.toLocaleString(),
                  text: CHANNEL_TERMS_TEXT,
                }
              : undefined,
          },
          {
            title: card ? "Card saved" : "Save a card",
            detail: card ? `${card.brand} ending ${card.last4}` : "We charge this when a customer pays you",
            done: Boolean(card),
            href: "/billing",
            tip: "Opens Billing. Save or replace the card there. It isn't store credit, and we only keep the brand and last four digits.",
          },
          {
            title: "Connect Shopify",
            detail: passed ? "Store connected" : SHOPIFY_CONNECT_MAINTENANCE ? "Under maintenance" : "Link your store",
            done: passed,
            href: "#connect",
            tip: "Takes you to your store on this page. Every wholesaler does this once per store.",
          },
        ]}
      />

      {!terms && (
        <ChannelPanel className="p-5 md:p-6" delay={80}>
          <div id="terms">
            <h2 className="font-display text-xl font-semibold">{CHANNEL_TERMS_TITLE}</h2>
            <p className="mt-1 text-xs text-[#5c5654]">Last updated {CHANNEL_TERMS_UPDATED}. Version {SHOPIFY_CHANNEL_TERMS_VERSION}.</p>
            <div className="mt-4">
              <TermsAccept text={CHANNEL_TERMS_TEXT} canAccept={canConnect} />
            </div>
          </div>
        </ChannelPanel>
      )}

      <div id="connect" className="space-y-4">
        {realConnections.map((connection, index) => {
          const sample = connection.shopDomain.startsWith("preview-");
          const readyTone = connection.addressTestStatus === "PASSED" ? "good" : connection.addressTestStatus === "FAILED" ? "bad" : "wait";
          const readyLabel = connection.addressTestStatus === "PASSED" ? "Ready" : connection.addressTestStatus === "FAILED" ? "Needs another look" : "Connecting";
          return (
            <ChannelPanel key={connection.id} className="p-5 md:p-6" delay={index * 40}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{sample ? "Sample" : "Store"}</p>
                  <h2 className="font-display text-2xl font-semibold">{sample ? "Sample store" : connection.shopDomain}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={readyTone}>{readyLabel}</StatusPill>
                  {connection.disconnectedAt ? (
                    <StatusPill tone="neutral">Disconnected</StatusPill>
                  ) : connection.paused ? (
                    <StatusPill tone="wait">Paused</StatusPill>
                  ) : (
                    <StatusPill tone="good">Connected</StatusPill>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-[#5c5654]">Listings <Tip text="Products from the catalog that are on this Shopify store right now." /></p>
                  <p className="font-display text-2xl font-semibold">{connection._count.listings}</p>
                </div>
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-[#5c5654]">Last stock sync <Tip text="The last time we updated a quantity on this store from our warehouse stock. Your prices are not changed." /></p>
                  <p className="mt-1 text-sm font-semibold">{connection.listings[0] ? connection.listings[0].updatedAt.toLocaleString() : "Not yet"}</p>
                </div>
                <div className="rounded-xl bg-[#f6f3f1] px-4 py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-[#5c5654]">Recent orders <Tip text="The latest orders from this store that include a product you added. Open Orders in the menu for the full list." /></p>
                  <p className="font-display text-2xl font-semibold">{connection.orders.length}</p>
                </div>
              </div>

              {connection.disconnectedAt ? (
                <p className="mt-4 text-sm leading-6 text-[#5c5654]">
                  This store is disconnected. Products already on Shopify stay there. Connect the same store again below to pick up where you left off.
                </p>
              ) : connection.addressTestStatus === "PASSED" ? (
                <p className="mt-4 text-sm leading-6 text-[#5c5654]">
                  {connection.paused
                    ? "Paused. Customers can still buy on Shopify. We see the order, but we do not charge your card or ship it. You handle that sale. Resume applies to new sales only."
                    : "This store is connected. When a customer pays, we charge your card and ship the order."}
                </p>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#5c5654]">
                  Shopify is finishing this connection. Refresh the page in a moment. If it still is not ready, open Support and we will take a look.
                </p>
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
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <form action="/api/portal/shopify-channel/pause" method="post">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <input type="hidden" name="paused" value={connection.paused ? "false" : "true"} />
                    <button
                      className={channelGhostBtn}
                      type="submit"
                      title={connection.paused
                        ? "New sales are charged and shipped again. A sale that came in while this was paused is not shipped later. Example: a customer paid you during the pause. That order stays on Shopify for you to refund or handle."
                        : "Customers can still buy on your Shopify store. We see the order, but we do not charge your card and we do not ship it. Example: you pause before a trip, a customer buys a listed product and pays you on Shopify, and you handle that sale. Products stay up. When you resume, only new sales are charged and shipped."}
                    >
                      {connection.paused ? "Resume new orders" : "Pause new orders"}
                    </button>
                  </form>
                  <Tip text={connection.paused
                    ? "New sales are charged and shipped again. A sale that came in while this was paused is not shipped later. Example: a customer paid you during the pause. That order stays on Shopify for you to refund or handle."
                    : "Customers can still buy on your Shopify store. We see the order, but we do not charge your card and we do not ship it. Example: you pause before a trip, a customer buys a listed product and pays you on Shopify, and you handle that sale. Products stay up. When you resume, only new sales are charged and shipped."} />
                  <form action="/api/portal/shopify-channel/disconnect" method="post">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <button className={channelGhostBtn} type="submit" title="Disconnect one store. New sales stop and stock stops updating. Products already on that Shopify store stay there.">
                      Disconnect
                    </button>
                  </form>
                </div>
              )}
            </ChannelPanel>
          );
        })}

        {canConnect && SHOPIFY_CONNECT_MAINTENANCE && liveStores.length < 5 && (
          <ChannelPanel className="p-5 md:p-6">
            <h2 className="font-display text-xl font-semibold">Connect Shopify</h2>
            <p className="mt-2 text-sm leading-6 text-[#5c5654]">Connecting a store is under maintenance. We are fixing it, and the connect box will come back on this page. You do not need to try again right now.</p>
          </ChannelPanel>
        )}
        {canConnect && !SHOPIFY_CONNECT_MAINTENANCE && shopifyAppConfigured() && liveStores.length < 5 && (
          <ChannelPanel className="p-5 md:p-6">
            <h2 className="inline-flex items-center gap-1.5 font-display text-xl font-semibold">Connect Shopify <Tip text="Every Shopify store has an address ending in .myshopify.com. In Shopify, open Settings, then Domains. You can connect up to 5 stores. Products already on the store stay as they are." /></h2>
            <p className="mt-1 text-sm leading-6 text-[#5c5654]">Type your Shopify address, like your-store.myshopify.com. Pasting the full link, with https://, is fine. Shopify will ask you to approve it, including orders, so a sale shows up here on its own. Then you come back here. USD stores only. Up to 5 stores.</p>
            {query.connect === "unrecognized" && (
              <p className="mt-3 text-sm leading-6 text-[#B8282E]">Use the address that ends in .myshopify.com. You can find it in Shopify under Settings, then Domains.</p>
            )}
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
