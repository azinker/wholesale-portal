import { db } from "@/lib/db";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "./constants";

export type ChannelSetup = {
  terms: boolean;
  cardLast4: string | null;
  stores: Array<{ id: string; shopDomain: string }>;
  hasStore: boolean;
  ready: boolean;
};

export async function loadChannelSetup(accountId: string): Promise<ChannelSetup> {
  const [terms, card, connections] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
      select: { id: true },
    }),
    db.sellerPaymentMethod.findUnique({
      where: { accountId },
      select: { last4: true },
    }),
    db.shopifyConnection.findMany({
      where: {
        accountId,
        disconnectedAt: null,
        NOT: { shopDomain: { startsWith: "preview-" } },
      },
      select: { id: true, shopDomain: true, addressTestStatus: true },
    }),
  ]);
  const stores = connections
    .filter((row) => row.addressTestStatus === "PASSED")
    .map((row) => ({ id: row.id, shopDomain: row.shopDomain }));
  return {
    terms: Boolean(terms),
    cardLast4: card?.last4 || null,
    stores,
    hasStore: connections.length > 0,
    ready: Boolean(terms && card && stores.length > 0),
  };
}
