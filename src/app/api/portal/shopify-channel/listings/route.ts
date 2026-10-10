import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { requirePortalAccount } from "@/lib/portal-auth";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { listingDetails, publishBigCommerceProduct, removeListing, cleanPush, plainAddError } from "@/lib/shopify-channel/publish";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { loadChannelSetup } from "@/lib/shopify-channel/setup";

async function readyStores(accountId: string) {
  const [terms, card, stores] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    }),
    db.sellerPaymentMethod.findUnique({ where: { accountId } }),
    db.shopifyConnection.findMany({
      where: {
        accountId,
        disconnectedAt: null,
        addressTestStatus: "PASSED",
        NOT: { shopDomain: { startsWith: "preview-" } },
      },
    }),
  ]);
  return { terms, card, stores, ready: Boolean(terms && card && stores.length > 0) };
}

export async function GET(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_listings");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const setup = await loadChannelSetup(auth.user.wholesaleAccount.id);
  if (!setup.ready) return NextResponse.json({ error: "Agree to the terms, save a card, and connect your store first" }, { status: 403 });
  if (req.nextUrl.searchParams.get("cards") === "1") {
    const scope = req.nextUrl.searchParams.get("scope") === "catalog" ? "catalog" : "search";
    const keyword = scope === "catalog" ? undefined : req.nextUrl.searchParams.get("q") || undefined;
    const categoryRaw = req.nextUrl.searchParams.get("category");
    const categoryId = scope === "catalog" || !categoryRaw ? undefined : Number(categoryRaw);
    const inStock = req.nextUrl.searchParams.get("stock") === "1";
    const earned = await getTierDiscountPercent(auth.user.wholesaleAccount.lastTier);
    const welcome = await loadWelcomeConfig();
    const percent = isWelcomeActive(auth.user.wholesaleAccount.welcomeExpiresAt) && welcome.enabled && welcome.discount > earned
      ? welcome.discount
      : earned;
    const cards: Array<{ id: number; name: string; image?: string; stock: number; retail: number; cost: number }> = [];
    for (let page = 1; page <= 20 && cards.length < 800; page++) {
      const result = await bc().getProducts({
        is_visible: true,
        keyword,
        categoryId: categoryId && Number.isInteger(categoryId) ? categoryId : undefined,
        inStock,
        include: "images",
        limit: 50,
        page,
      });
      const rows = result.data || [];
      for (const product of rows) {
        const retail = Number(product.calculated_price || product.price || 0);
        const image = product.images?.find((row) => row.is_thumbnail) || product.images?.[0];
        cards.push({
          id: product.id,
          name: product.name,
          image: image?.url_thumbnail,
          stock: product.inventory_level,
          retail,
          cost: wholesaleUnitCost(retail, percent),
        });
      }
      const pages = result.meta?.pagination?.total_pages || page;
      if (rows.length === 0 || page >= pages) break;
    }
    return NextResponse.json({ products: cards });
  }
  const keyword = req.nextUrl.searchParams.get("q") || undefined;
  const categoryRaw = req.nextUrl.searchParams.get("category");
  const categoryId = categoryRaw ? Number(categoryRaw) : undefined;
  const productRaw = req.nextUrl.searchParams.get("bcProductId");
  const bcProductId = productRaw ? Number(productRaw) : 0;
  if (Number.isInteger(bcProductId) && bcProductId > 0) {
    const receipts = await listingDetails(auth.user.wholesaleAccount.id, bcProductId);
    if (receipts.length === 0) return NextResponse.json({ error: "This product is not on your Shopify store yet" }, { status: 404 });
    return NextResponse.json({ receipts });
  }
  const result = await bc().getProducts({
    is_visible: true,
    keyword,
    categoryId: categoryId && Number.isInteger(categoryId) ? categoryId : undefined,
    limit: 1,
  });
  return NextResponse.json({ total: result.meta?.pagination?.total || 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_listings");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const account = auth.user.wholesaleAccount;
  const body = (await req.json()) as {
    bcProductIds?: number[];
    connectionIds?: string[];
    scope?: "selection" | "category" | "catalog";
    keyword?: string;
    categoryId?: number;
    push?: unknown;
    pushes?: Record<string, unknown>;
  };
  const scope = body.scope || "selection";
  const ids = (body.bcProductIds || []).filter((id) => Number.isInteger(id));
  if (scope === "selection" && ids.length === 0) {
    return NextResponse.json({ error: "Choose a product" }, { status: 400 });
  }

  const setup = await readyStores(account.id);
  if (!setup.ready) {
    return NextResponse.json({ error: "Accept the terms, save a card, and connect your store first" }, { status: 400 });
  }
  const chosen = body.connectionIds?.length
    ? setup.stores.filter((store) => body.connectionIds?.includes(store.id))
    : setup.stores.length === 1
      ? setup.stores
      : [];
  if (chosen.length === 0) {
    return NextResponse.json({ error: "Choose which store to add to" }, { status: 400 });
  }

  const push = cleanPush(body.push);
  const pushes: Record<string, ReturnType<typeof cleanPush>> = {};
  if (body.pushes && typeof body.pushes === "object") {
    for (const [key, value] of Object.entries(body.pushes)) {
      if (!/^\d+$/.test(key)) continue;
      pushes[key] = cleanPush(value);
    }
  }
  if (Object.keys(pushes).length === 0 && ids.length !== 1) {
    delete push.sellerSku;
    delete push.compareAt;
  }

  const jobs = [];
  for (const connection of chosen) {
    const running = await db.channelPublishJob.findFirst({
      where: { connectionId: connection.id, status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (running) {
      return NextResponse.json(
        { error: `${connection.shopDomain} already has a listing job in progress` },
        { status: 409 }
      );
    }
    const job = await db.channelPublishJob.create({
      data: {
        accountId: account.id,
        connectionId: connection.id,
        requestedByUserId: auth.user.id,
        requestedByEmail: auth.user.email,
        scope: scope === "catalog" ? "CATALOG" : scope === "category" ? "CATEGORY" : ids.length === 1 ? "ONE" : "SELECTION",
        detail:
          scope === "selection"
            ? { bcProductIds: ids, push, pushes, total: ids.length }
            : { keyword: body.keyword || "", categoryId: body.categoryId || null, page: 1, push, total: ids.length },
      },
    });
    jobs.push(job);
  }

  if (scope === "selection" && ids.length === 1 && jobs.length === 1) {
    const job = jobs[0];
    const connection = chosen[0];
    try {
      const receipt = await publishBigCommerceProduct(connection.id, ids[0], pushes[String(ids[0])] || push);
      await db.channelPublishJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          addedCount: receipt.status === "added" ? 1 : 0,
          skippedCount: receipt.status === "skipped" ? 1 : 0,
          failedCount: receipt.status === "failed" ? 1 : 0,
          emailSentAt: new Date(),
        },
      });
      if (receipt.status === "failed") {
        return NextResponse.json({ error: receipt.message, receipt }, { status: 422 });
      }
      return NextResponse.json({ ok: true, jobIds: [job.id], receipt });
    } catch (error) {
      await db.channelPublishJob.update({
        where: { id: job.id },
        data: { status: "FAILED", failedCount: 1, emailSentAt: new Date() },
      });
      return NextResponse.json({ error: plainAddError(error) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, jobIds: jobs.map((job) => job.id) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_listings");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bcProductId = Number(req.nextUrl.searchParams.get("bcProductId"));
  if (!Number.isInteger(bcProductId) || bcProductId <= 0) {
    return NextResponse.json({ error: "Choose a product" }, { status: 400 });
  }
  const shop = req.nextUrl.searchParams.get("shop");
  const listings = await db.channelListing.findMany({
    where: {
      accountId: auth.user.wholesaleAccount.id,
      bcProductId,
      removedAt: null,
      connection: {
        disconnectedAt: null,
        ...(shop ? { shopDomain: shop } : {}),
      },
    },
  });
  const seen = new Set<string>();
  for (const listing of listings) {
    const key = `${listing.connectionId}:${listing.shopifyProductId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await removeListing(listing.id);
  }
  return NextResponse.json({ ok: true, removed: seen.size });
}
