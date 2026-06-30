import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/portal-auth";
import { bc } from "@/lib/bigcommerce/client";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("place_orders");
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  let body: { orderId?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = Number(body.orderId);
  if (!orderId || Number.isNaN(orderId)) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const customerId = user.linkedCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: "No linked customer account" }, { status: 403 });
  }

  try {
    const order = await bc().getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.customer_id !== customerId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const products = await bc().getOrderProducts(orderId);
    if (!products.length) {
      return NextResponse.json({ error: "No products in order" }, { status: 400 });
    }

    const storeDomain = bc().getStoreDomain();

    // BigCommerce cart.php accepts array-style params for multiple line items
    const params = products
      .flatMap((p) => [`product_id[]=${p.product_id}`, `qty[]=${p.quantity}`])
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
