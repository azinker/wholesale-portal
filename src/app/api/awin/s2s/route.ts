import { NextRequest, NextResponse } from "next/server";
import { bc } from "@/lib/bigcommerce/client";

/**
 * AWIN Server-to-Server (S2S) Proxy
 *
 * Called from the BigCommerce order confirmation page via JavaScript.
 * This endpoint:
 * 1. Receives orderId, amount, voucher, AWC, and channel from the client
 *    (client already has accurate data from BC Storefront API + placeholders)
 * 2. Sends conversion to AWIN via direct S2S (sread.php GET request)
 *    with manually-built URL to avoid URLSearchParams encoding issues
 * 3. Falls back to BigCommerce Management API if client data is missing
 *
 * Refs:
 *   https://developer.awin.com/docs/direct-s2s
 *   https://developer.awin.com/docs/parameter-guidance
 *   https://help.awin.com/docs/bigcommerce
 *
 * Environment variables:
 *   AWIN_ADVERTISER_ID  (e.g. "121802")
 */

const AWIN_ADVERTISER_ID = (process.env.AWIN_ADVERTISER_ID || "121802").trim();

// Allowed origins (BigCommerce storefront)
const ALLOWED_ORIGINS = [
  "https://theperfectpart.net",
  "https://www.theperfectpart.net",
  "http://localhost:3000",
];

function corsHeaders(origin: string | null) {
  const allowed = ALLOWED_ORIGINS.includes(origin || "");
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// Simple dedup: prevent double-sending the same orderId
const recentOrders = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isDuplicate(orderId: string): boolean {
  const now = Date.now();
  for (const [k, v] of recentOrders.entries()) {
    if (now - v > DEDUP_WINDOW_MS) recentOrders.delete(k);
  }
  if (recentOrders.has(orderId)) return true;
  recentOrders.set(orderId, now);
  return false;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const {
      orderId,
      awc,
      channel,
      clientAmount,
      clientVoucher,
    } = body as {
      orderId: string;
      awc?: string;
      channel?: string;
      clientAmount?: string;
      clientVoucher?: string;
    };

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400, headers }
      );
    }

    // Dedup check
    if (isDuplicate(orderId)) {
      return NextResponse.json(
        { success: true, message: "Already sent (deduplicated)" },
        { headers }
      );
    }

    // ── Determine amount and voucher ───────────────────
    // Prefer client values (client gets them from BC placeholders + Storefront API).
    // Fall back to BC Management API if client data looks wrong.
    const isPlaceholder = (v: string) => /%%\w+%%/.test(v);
    let amount = clientAmount ? clientAmount.trim() : "";
    let voucher = clientVoucher ? clientVoucher.trim() : "";
    let currency = "USD";

    // Strip any placeholder values
    if (isPlaceholder(amount)) amount = "";
    if (isPlaceholder(voucher)) voucher = "";

    // If amount is missing or invalid, fetch from BigCommerce
    if (!amount || isNaN(parseFloat(amount))) {
      try {
        const order = await bc().getOrderById(Number(orderId));
        if (order) {
          const subtotal = parseFloat(order.subtotal_ex_tax || "0");
          const discount = parseFloat(order.discount_amount || "0");
          const couponDiscount = parseFloat(order.coupon_discount || "0");
          const calc = Math.max(0, subtotal - discount - couponDiscount);
          amount = calc.toFixed(2);
          currency = order.currency_code || "USD";
        }
      } catch (err) {
        console.warn("[AWIN S2S] Failed to fetch order from BC:", err);
      }
    }

    // If voucher is missing, try fetching from BigCommerce
    if (!voucher) {
      try {
        const coupons = await bc().getOrderCoupons(Number(orderId));
        if (coupons && coupons.length > 0) {
          voucher = coupons.map((c) => c.code).join(",");
        }
      } catch {
        // best-effort
      }
    }

    // Ensure amount has 2 decimal places
    if (amount) {
      amount = parseFloat(amount).toFixed(2);
    } else {
      amount = "0.00";
    }

    const ch = channel || "aw";

    // ── Build direct S2S URL manually ──────────────────
    // Do NOT use URLSearchParams -- it encodes ":" as "%3A" in
    // "DEFAULT:X.XX" which causes AWIN to flag parameter mismatches.
    // Ref: https://developer.awin.com/docs/direct-s2s
    const s2sUrl =
      "https://www.awin1.com/sread.php" +
      "?tt=ss" +
      "&tv=2" +
      "&merchant=" + AWIN_ADVERTISER_ID +
      "&amount=" + amount +
      "&ch=" + encodeURIComponent(ch) +
      "&parts=DEFAULT:" + amount +
      "&vc=" + encodeURIComponent(voucher) +
      "&cr=" + encodeURIComponent(currency) +
      "&ref=" + encodeURIComponent(String(orderId)) +
      "&testmode=0" +
      (awc ? "&cks=" + encodeURIComponent(awc) : "");

    console.log("[AWIN S2S] Sending direct S2S:", s2sUrl);

    // ── Send to AWIN ────────────────────────────────────
    const awinRes = await fetch(s2sUrl, {
      method: "GET",
      headers: {
        Referer: "https://www.theperfectpart.net",
      },
    });

    const awinBody = await awinRes.text();
    console.log(`[AWIN S2S] Response ${awinRes.status}:`, awinBody);

    if (awinRes.ok) {
      return NextResponse.json(
        { success: true, status: awinRes.status },
        { headers }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "AWIN S2S error",
          status: awinRes.status,
          body: awinBody,
        },
        { status: 502, headers }
      );
    }
  } catch (error) {
    console.error("[AWIN S2S] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers }
    );
  }
}
