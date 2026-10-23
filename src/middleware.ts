import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

const APP_URL = "https://wholesale.theperfectpart.net/my-shopify";

/** Renders the connected page while the browser address stays on /my-shopify. */
function installedPage(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/shopify-installed";
  url.search = "";
  return NextResponse.rewrite(url);
}

/** The app address with only shop and host, which is where Shopify expects to land after authentication. */
function appHome(handle: string, host: string | null) {
  const url = new URL(APP_URL);
  url.searchParams.set("shop", `${handle}.myshopify.com`);
  if (host && /^[A-Za-z0-9+/=_-]+$/.test(host)) url.searchParams.set("host", host);
  return NextResponse.redirect(url, 302);
}

async function gate(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || "3001"}/api/shopify/install-gate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Shopify keeps no cookie between its install visit and its post-approval visit, so the server remembers. */
async function returnVisit(handle: string): Promise<boolean> {
  const body = await gate({ shop: handle });
  return body?.showApp === true;
}

async function homeReady(): Promise<boolean> {
  const body = await gate({ home: true });
  return body?.showHome === true;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  // A signed-in wholesaler always gets the real portal page.
  if (request.cookies.get("wsp_session")) return NextResponse.next();

  const params = request.nextUrl.searchParams;
  const handle = shopHandle(params.get("shop") || "");
  if (!handle) {
    if (await homeReady()) return installedPage(request);
    return NextResponse.next();
  }

  // Signed visits (hmac present) come from Shopify opening the app.
  // The first one for a store is the install and goes to the grant screen.
  // The next one is after approval and must 3xx to the app address with shop and host.
  if (params.has("hmac")) {
    if (await returnVisit(handle)) return appHome(handle, params.get("host"));
    return NextResponse.redirect(`https://admin.shopify.com/store/${handle}/app/grant`);
  }

  // Unsigned visit with shop (and host): render the app page, no further redirect.
  return installedPage(request);
}

export const config = {
  matcher: ["/my-shopify"],
};
