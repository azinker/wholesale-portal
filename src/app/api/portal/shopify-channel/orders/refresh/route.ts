import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { requirePortalAccount } from "@/lib/portal-auth";
import { refreshAccountOrders } from "@/lib/shopify-channel/orders";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("view_channel");
  const back = new URLSearchParams();
  if (!auth.user?.wholesaleAccount || !(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.redirect(appUrl("/my-shopify/orders"), 303);
  }
  const form = await req.formData();
  for (const key of ["view", "product", "q"] as const) {
    const value = String(form.get(key) || "").trim();
    if (value) back.set(key, value);
  }
  try {
    const result = await refreshAccountOrders(auth.user.wholesaleAccount.id);
    if (!result.ok) back.set("refresh", "error");
    else if (result.found > 0) back.set("refresh", "new");
  } catch {
    back.set("refresh", "error");
  }
  const query = back.toString();
  return NextResponse.redirect(appUrl(query ? `/my-shopify/orders?${query}` : "/my-shopify/orders"), 303);
}
