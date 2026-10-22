import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

/** Shopify's install check opens the app URL with ?shop= and expects the grant screen.
 *  After the merchant approves, Shopify returns with ?shop= and ?hmac=. That visit must be the app page, not grant again. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  const params = request.nextUrl.searchParams;
  const handle = shopHandle(params.get("shop") || "");
  if (!handle) return NextResponse.next();
  if (params.get("hmac")) {
    const url = request.nextUrl.clone();
    url.pathname = "/shopify-installed";
    url.search = "";
    return NextResponse.rewrite(url);
  }
  return NextResponse.redirect(`https://admin.shopify.com/store/${handle}/app/grant`);
}

export const config = {
  matcher: ["/my-shopify"],
};
