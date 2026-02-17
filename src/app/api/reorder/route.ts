import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { bc } from "@/lib/bigcommerce/client";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  try {
    const products = await bc().getOrderProducts(orderId);
    const storeDomain = bc().getStoreDomain();

    // Build cart URL with product_id and qty params
    const params = products
      .map((p) => `product_id=${p.product_id}&qty=${p.quantity}`)
      .join("&");

    const cartUrl = `https://${storeDomain}/cart.php?action=add&${params}`;

    return NextResponse.json({ cartUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch order products" },
      { status: 500 }
    );
  }
}
