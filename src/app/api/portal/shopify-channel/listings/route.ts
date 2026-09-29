import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { requirePortalAccount } from "@/lib/portal-auth";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { listingDetails, publishBigCommerceProduct, removeListing } from "@/lib/shopify-channel/publish";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

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
  };
  const scope = body.scope || "selection";
  const ids = (body.bcProductIds || []).filter((id) => Number.isInteger(id));
  if (scope === "selection" && ids.length === 0) {
    return NextResponse.json({ error: "Choose a product" }, { status: 400 });
  }

  const setup = await readyStores(account.id);
  if (!setup.ready) {
    return NextResponse.json({ error: "Finish the terms, save a credit card, and pass the address test first" }, { status: 400 });
  }
  const chosen = body.connectionIds?.length
    ? setup.stores.filter((store) => body.connectionIds?.includes(store.id))
    : setup.stores.length === 1
      ? setup.stores
      : [];
  if (chosen.length === 0) {
    return NextResponse.json({ error: "Choose which store to add to" }, { status: 400 });
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
            ? { bcProductIds: ids }
            : { keyword: body.keyword || "", categoryId: body.categoryId || null, page: 1 },
      },
    });
    jobs.push(job);
  }

  if (scope === "selection" && ids.length === 1 && jobs.length === 1) {
    const job = jobs[0];
    const connection = chosen[0];
    try {
      const receipt = await publishBigCommerceProduct(connection.id, ids[0]);
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
      const message = error instanceof Error ? error.message : "Add failed";
      const friendly = message.startsWith("Shopify ")
        ? "Shopify did not accept this product. Wait a minute and try again."
        : message;
      return NextResponse.json({ error: friendly }, { status: 500 });
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
