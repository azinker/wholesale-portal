import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

const GRANT_COOKIE = "wsp_shopify_grant";

/** The install visit already includes shop, hmac, and host, and must go to the grant screen.
 *  Shopify's next check loads that same address after approval. The cookie marks the return so it opens the app page. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  const handle = shopHandle(request.nextUrl.searchParams.get("shop") || "");
  if (!handle) return NextResponse.next();
  if (request.cookies.get(GRANT_COOKIE)?.value === handle) {
    const url = request.nextUrl.clone();
    url.pathname = "/shopify-installed";
    url.search = "";
    return NextResponse.rewrite(url);
  }
  const response = NextResponse.redirect(`https://admin.shopify.com/store/${handle}/app/grant`);
  response.cookies.set(GRANT_COOKIE, handle, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/my-shopify"],
};
