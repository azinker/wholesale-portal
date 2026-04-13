import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { bc, type BCProduct } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MarginInput } from "./margin-input";

/**
 * Seeded shuffle using a simple LCG PRNG.
 * Produces the same shuffle for the same seed, so products rotate
 * every 30 minutes but stay stable within a window.
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed;
  function random() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Mark that user visited hot sellers (for onboarding)
async function trackHotSellersVisit(accountId: string) {
  try {
    const account = await db.wholesaleAccount.findUnique({
      where: { id: accountId },
      select: { onboardingFlags: true },
    });
    const flags = (account?.onboardingFlags as Record<string, boolean>) || {};
    if (!flags.browsedHotSellers) {
      await db.wholesaleAccount.update({
        where: { id: accountId },
        data: {
          onboardingFlags: { ...flags, browsedHotSellers: true },
        },
      });
    }
  } catch {
    // Non-critical, don't fail the page
  }
}

function getTierDiscount(tier: string): number {
  switch (tier) {
    case "T10": return 10;
    case "T15": return 15;
    case "T20": return 20;
    default: return 0;
  }
}

function getStockStatus(product: BCProduct): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (product.inventory_tracking === "none") {
    return { label: "In Stock", variant: "default" };
  }
  if (product.inventory_level <= 0) {
    return { label: "Out of Stock", variant: "destructive" };
  }
  if (product.inventory_level < 10) {
    return { label: "Low Stock", variant: "secondary" };
  }
  return { label: "In Stock", variant: "default" };
}

function getMainImage(product: BCProduct): string | null {
  if (!product.images || product.images.length === 0) return null;
  const thumb = product.images.find((img) => img.is_thumbnail);
  return thumb?.url_standard || product.images[0]?.url_standard || null;
}

export default async function HotSellersPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const account = user.wholesaleAccount;
  const isApproved = account?.status === "APPROVED";
  const tier = account?.lastTier || "NONE";
  const discountPct = getTierDiscount(tier);

  // Track visit for onboarding
  if (account?.id) {
    await trackHotSellersVisit(account.id);
  }

  let products: BCProduct[] = [];
  let fetchError = "";

  try {
    // Fetch a larger pool (top 60) and rotate a selection of 20
    const res = await bc().getProducts({
      sort: "total_sold",
      direction: "desc",
      limit: 60,
      include: "images",
      is_visible: true,
    });
    const allProducts = res.data || [];

    // Seeded shuffle: changes every 30 minutes for rotation
    const seed = Math.floor(Date.now() / (30 * 60 * 1000));
    products = seededShuffle(allProducts, seed).slice(0, 20);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch products";
    // Show user-friendly error instead of raw API details
    if (msg.includes("403") || msg.includes("scope")) {
      fetchError = "Hot Sellers is temporarily unavailable. The store connection is being configured. Please check back soon.";
    } else {
      fetchError = "Unable to load products right now. Please try again later.";
    }
    console.error("Hot Sellers fetch error:", msg);
  }

  const storeDomain = bc().getStoreDomain();

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Hot Sellers
        </h1>
        <p className="text-muted-foreground mt-1">
          Best-selling products from The Perfect Part. Refreshes regularly with new picks.
        </p>
      </div>

      {!isApproved && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>Want wholesale pricing?</strong>{" "}
              <Link href="/" className="text-primary underline underline-offset-2">
                Apply for a wholesale account
              </Link>{" "}
              to see discounted tier prices on all products.
            </p>
          </CardContent>
        </Card>
      )}

      {fetchError && (
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{fetchError}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => {
          const imgUrl = getMainImage(product);
          const retailPrice = product.price;
          const tierPrice = isApproved && discountPct > 0
            ? retailPrice * (1 - discountPct / 100)
            : null;
          const savings = tierPrice ? retailPrice - tierPrice : 0;
          const stock = getStockStatus(product);
          const productUrl = `https://${storeDomain}${product.custom_url?.url || ""}`;

          return (
            <Card key={product.id} className="overflow-hidden flex flex-col">
              {/* Image */}
              <div className="relative aspect-square bg-muted/30 overflow-hidden">
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={product.name}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    No Image
                  </div>
                )}
                {/* Popular tag */}
                <Badge className="absolute top-2 left-2 bg-green-600 hover:bg-green-700 text-white text-[10px]">
                  Popular
                </Badge>
                {/* Stock badge */}
                <Badge
                  variant={stock.variant}
                  className="absolute top-2 right-2 text-[10px]"
                >
                  {stock.label}
                </Badge>
              </div>

              {/* Content */}
              <CardContent className="pt-3 pb-3 flex-1 flex flex-col">
                <h3 className="text-sm font-medium line-clamp-2 leading-tight">
                  {product.name}
                </h3>

                {/* Pricing */}
                <div className="mt-2 space-y-1">
                  {tierPrice ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-green-600">
                          ${tierPrice.toFixed(2)}
                        </span>
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">
                          {discountPct}% OFF
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">
                          ${retailPrice.toFixed(2)}
                        </span>
                        <span className="text-xs text-green-600 font-medium">
                          Save ${savings.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-lg font-bold">${retailPrice.toFixed(2)}</span>
                  )}
                </div>

                {/* SKU */}
                {product.sku && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    SKU: {product.sku}
                  </p>
                )}

                {/* View on store link */}
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View on Store <ExternalLink className="h-3 w-3" />
                </a>

                {/* Inline margin calc for approved users */}
                {tierPrice && <MarginInput costPrice={tierPrice} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {products.length === 0 && !fetchError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No products found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
