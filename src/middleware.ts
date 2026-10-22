import { NextRequest, NextResponse } from "next/server";

function shopHandle(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

const GRANT_COOKIE = "wsp_shopify_grant";

function installedPage(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/shopify-installed";
  url.search = "";
  return NextResponse.rewrite(url);
}

/** First visit goes to the grant screen. After that, Shopify wants the app page inside the admin. */
async function adminAppHome(handle: string): Promise<string | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || "3001"}/api/shopify/install-gate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop: handle }),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.showApp === true && typeof body.home === "string" && body.home.startsWith("https://admin.shopify.com/")
      ? body.home
      : null;
  } catch {
    return null;
  }
}

async function homeReady(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || "3001"}/api/shopify/install-gate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ home: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body.showHome === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/my-shopify") return NextResponse.next();
  const handle = shopHandle(request.nextUrl.searchParams.get("shop") || "");
  if (!handle) {
    if (request.cookies.get("wsp_session")) return NextResponse.next();
    if (await homeReady()) return installedPage(request);
    return NextResponse.next();
  }
  const home = await adminAppHome(handle);
  if (home) return NextResponse.redirect(home);
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
