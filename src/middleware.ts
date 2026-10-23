import { NextRequest, NextResponse } from "next/server";

function validShop(input: string): boolean {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain);
}

/** Renders the installed page while the browser address stays on /my-shopify. */
function installedPage(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/shopify-installed";
  url.search = "";
  return NextResponse.rewrite(url);
}

/** Starts Shopify's authorization code grant without changing the browser address. */
function startInstall(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/shopify/channel/install";
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  // A signed-in wholesaler always gets the real portal page.
  if (request.cookies.get("wsp_session")) return NextResponse.next();

  const params = request.nextUrl.searchParams;
  if (!validShop(params.get("shop") || "")) return NextResponse.next();

  // Signed visit (hmac present): Shopify is opening the app for a store.
  // Answer with the authorization redirect; the callback finishes the install.
  if (params.has("hmac")) return startInstall(request);

  // Unsigned visit with shop (and host): this is the landing after authorization.
  return installedPage(request);
}

export const config = {
  matcher: ["/my-shopify"],
};
