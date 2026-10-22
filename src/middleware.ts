import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

/** Install opens the app URL with ?shop= and ?hmac= and must go to the grant screen.
 *  After approval, Shopify returns with ?host= as well. That visit is the app page. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  const params = request.nextUrl.searchParams;
  const handle = shopHandle(params.get("shop") || "");
  if (!handle) return NextResponse.next();
  if (params.get("host")) {
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
