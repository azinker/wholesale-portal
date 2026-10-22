import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

/** Shopify's install check opens the app URL with ?shop=. Send it to the grant screen before the portal login redirect. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  const handle = shopHandle(request.nextUrl.searchParams.get("shop") || "");
  if (!handle) return NextResponse.next();
  return NextResponse.redirect(`https://admin.shopify.com/store/${handle}/app/grant`);
}

export const config = {
  matcher: ["/my-shopify"],
};
