import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_API_VERSION, SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { CHANNEL_TERMS_TEXT, CHANNEL_TERMS_TITLE, CHANNEL_TERMS_UPDATED } from "@/lib/shopify-channel/terms";
import { shopifyAppConfigured } from "@/lib/shopify-channel/shopify-admin";
import { env } from "@/lib/env";
import { TermsAccept } from "./terms-accept";
import { CopyUrl } from "./copy-url";
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
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const realConnections = connections.filter((row) => !row.shopDomain.startsWith("preview-"));
  const liveStores = realConnections.filter((row) => !row.disconnectedAt);
  const passed = liveStores.some((row) => row.addressTestStatus === "PASSED");
  const setupDone = Boolean(terms && card && passed);

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="My Shopify"
        lede="Connect your Shopify store and start selling. You can connect up to 5 stores."
      />

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
            detail: passed ? "Store connected" : "Link your store",
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
          const webhookUrl = `${appUrl}/api/shopify/channel/webhook/${connection.id}/${connection.webhookToken}`;
          const shopHandle = connection.shopDomain.replace(/\.myshopify\.com$/, "");
          const notificationsUrl = `https://admin.shopify.com/store/${shopHandle}/settings/notifications`;
          const sample = connection.shopDomain.startsWith("preview-");
          const readyTone = connection.addressTestStatus === "PASSED" ? "good" : connection.addressTestStatus === "FAILED" ? "bad" : "wait";
          const readyLabel = connection.addressTestStatus === "PASSED" ? "Ready" : connection.addressTestStatus === "FAILED" ? "Needs another look" : "Not finished";
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
                  This store is connected. When a customer pays, we charge your card and ship the order.
                </p>
              ) : (
                <div className="mt-5 rounded-xl border border-[#efeae7] bg-[#fbfaf9] p-4">
                  <p className="font-semibold text-[#1a1a1a]">Tell Shopify when a customer pays</p>
                  <p className="mt-1 text-sm leading-6 text-[#5c5654]">
                    This is a one-time step for every store. Open Shopify, add two notices, and send a sample from each. Then refresh this page. It changes to Ready.
                  </p>
                  <a href={notificationsUrl} target="_blank" rel="noopener noreferrer" className={`${channelPrimaryBtn} mt-3`}>
                    Open Shopify notifications
                  </a>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-[#3f3a38]">
                    <li><span className="font-semibold text-[#1a1a1a]">1.</span> On that page, scroll to Webhooks and click Create webhook.</li>
                    <li>
                      <span className="font-semibold text-[#1a1a1a]">2. First notice.</span> Event: Order payment. Format: JSON. Paste the address below. Version: {SHOPIFY_API_VERSION}. Save.
                    </li>
                    <li>
                      <span className="font-semibold text-[#1a1a1a]">3. Second notice.</span> Click Create webhook again. Event: Order update. Format: JSON. Same address. Version: {SHOPIFY_API_VERSION}. Save.
                    </li>
                    <li><span className="font-semibold text-[#1a1a1a]">4.</span> On each row, click the three dots and choose Send test. Come back here and refresh.</li>
                  </ol>
                  <div className="mt-4">
                    <CopyUrl value={webhookUrl} />
                  </div>
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
                  <summary className="cursor-pointer font-semibold">Still not ready? Paste a Shopify token</summary>
                  <p className="mt-2 leading-6 text-[#5c5654]">
                    In Shopify, create a custom app, allow it to read orders, install it, and paste the Admin API token plus one order number.
                  </p>
                  <form action="/api/portal/shopify-channel/token" method="post" className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <input name="token" type="password" placeholder="Admin API token" className={channelField} aria-label="Admin API token" />
                    <input name="orderId" placeholder="An order number" className={channelField} aria-label="Order number" />
                    <button className={channelPrimaryBtn} type="submit">Check token</button>
                  </form>
                </details>
              )}
            </ChannelPanel>
          );
        })}

        {canConnect && shopifyAppConfigured() && liveStores.length < 5 && (
          <ChannelPanel className="p-5 md:p-6">
            <h2 className="inline-flex items-center gap-1.5 font-display text-xl font-semibold">Connect Shopify <Tip text="Use the website your customers visit, or the .myshopify.com address. You can connect up to 5 stores. Products already on the store stay as they are." /></h2>
            <p className="mt-1 text-sm leading-6 text-[#5c5654]">Type your store address. That can be the website customers already use, like www.yourstore.com, or the Shopify address, like your-store.myshopify.com. Shopify will ask you to approve it, including orders, so a sale shows up here on its own. Then you come back here. USD stores only. Up to 5 stores.</p>
            {query.connect === "unrecognized" && (
              <p className="mt-3 text-sm leading-6 text-[#B8282E]">We couldn't find a Shopify store at that address. Check the spelling, or try the .myshopify.com address.</p>
            )}
            <form action="/api/shopify/channel/connect" method="get" className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="shop">Store domain</label>
              <input id="shop" name="shop" placeholder="www.yourstore.com" className={channelField} />
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
