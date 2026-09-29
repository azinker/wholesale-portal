import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { easternMonthKey } from "@/lib/shopify-channel/calendar";
import { isAffiliatedOrder } from "@/lib/shopify-channel/order-view";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

type Line = { title?: string; quantity?: number; salePrice?: number; unitCost?: number; lineCost?: number };

export async function GET(req: NextRequest) {
  const auth = await requirePortalAccount();
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const month = req.nextUrl.searchParams.get("month") || easternMonthKey(new Date());
  const orders = await db.channelOrder.findMany({
    where: { accountId: auth.user.wholesaleAccount.id },
    include: { connection: { select: { shopDomain: true } } },
    orderBy: { createdAt: "asc" },
  });
  const rows = ["date,store,order,product,quantity,sold for,tier,unit cost,charged,shipping,margin"];
  for (const order of orders) {
    if (easternMonthKey(order.createdAt) !== month) continue;
    if (!isAffiliatedOrder(order)) continue;
    const lines = Array.isArray(order.lines) ? (order.lines as Line[]) : [];
    const margin = Number(order.soldFor) - (Number(order.amountCharged) - Number(order.amountRefunded));
    if (lines.length === 0) {
      rows.push(
        [
          order.createdAt.toISOString(),
          order.connection.shopDomain,
          order.shopifyOrderName,
          "",
          "",
          Number(order.soldFor).toFixed(2),
          order.tier || "",
          "",
          Number(order.amountCharged).toFixed(2),
          Number(order.shippingCharged).toFixed(2),
          margin.toFixed(2),
        ].join(",")
      );
    }
    for (const line of lines) {
      const lineMargin = Number(line.salePrice || 0) * Number(line.quantity || 0) - Number(line.lineCost || 0);
      rows.push(
        [
          order.createdAt.toISOString(),
          order.connection.shopDomain,
          order.shopifyOrderName,
          `"${(line.title || "").replaceAll('"', '""')}"`,
          line.quantity || 0,
          (Number(line.salePrice || 0) * Number(line.quantity || 0)).toFixed(2),
          order.tier || "",
          Number(line.unitCost || 0).toFixed(2),
          Number(line.lineCost || 0).toFixed(2),
          Number(order.shippingCharged).toFixed(2),
          lineMargin.toFixed(2),
        ].join(",")
      );
    }
    if (Number(order.amountRefunded) > 0 && easternMonthKey(order.updatedAt) === month) {
      rows.push(
        [
          order.updatedAt.toISOString(),
          order.connection.shopDomain,
          order.shopifyOrderName,
          "Refund",
          "",
          "",
          "",
          "",
          (-Number(order.amountRefunded)).toFixed(2),
          "",
          "",
        ].join(",")
      );
    }
  }
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="shopify-${month}.csv"`,
    },
  });
}
