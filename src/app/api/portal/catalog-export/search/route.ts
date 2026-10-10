import { NextRequest, NextResponse } from "next/server";
import { bc } from "@/lib/bigcommerce/client";
import { requireExportAccount } from "@/lib/shopify-channel/export-access";

export async function GET(req: NextRequest) {
  const access = await requireExportAccount();
  if (!access.account) return access.response;
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page") || "1") || 1);
  const result = await bc().getProducts({
    is_visible: true,
    keyword: q || undefined,
    include: "images",
    limit: 24,
    page,
    sort: "name",
    direction: "asc",
  });
  return NextResponse.json({
    total: result.meta?.pagination?.total || 0,
    products: (result.data || []).map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.calculated_price || product.price || 0),
      image: product.images?.find((image) => image.is_thumbnail)?.url_thumbnail || product.images?.[0]?.url_thumbnail || null,
    })),
  });
}
