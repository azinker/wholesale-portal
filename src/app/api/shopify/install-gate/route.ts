import { mkdir, readFile, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "/tmp/shopify-install-gate.json";
const HOME_FILE = "/tmp/shopify-install-home.json";
const WINDOW_MS = 45 * 60 * 1000;
const HOME_MS = 10 * 60 * 1000;

type Phase = "grant" | "done";
type Store = Record<string, { at: number; phase: Phase }>;

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await mkdir("/tmp", { recursive: true });
  await writeFile(FILE, JSON.stringify(store));
}

async function readHome(): Promise<number> {
  try {
    const body = JSON.parse(await readFile(HOME_FILE, "utf8")) as { at?: number };
    return typeof body.at === "number" ? body.at : 0;
  } catch {
    return 0;
  }
}

async function armHome(now: number): Promise<void> {
  await mkdir("/tmp", { recursive: true });
  await writeFile(HOME_FILE, JSON.stringify({ at: now }));
}

/** First install visit for a shop is the grant screen. Later visits go to the app home address. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const now = Date.now();
  if (body?.home === true) {
    const at = await readHome();
    return NextResponse.json({ showHome: at > 0 && now - at < HOME_MS });
  }
  if (body?.armHome === true) {
    await armHome(now);
    return NextResponse.json({ ok: true });
  }
  const shop = typeof body?.shop === "string" ? body.shop : "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(shop)) {
    return NextResponse.json({ showApp: false });
  }
  const store = await readStore();
  const current = store[shop];
  const fresh = current && now - current.at < WINDOW_MS && current.phase === "grant";
  if (fresh) {
    await armHome(now);
    const clientId = process.env.SHOPIFY_CHANNEL_CLIENT_ID?.trim() || "";
    const home = /^[a-z0-9]+$/.test(clientId)
      ? `https://admin.shopify.com/store/${shop}/apps/${clientId}`
      : "";
    return NextResponse.json({ showApp: true, home });
  }
  store[shop] = { at: now, phase: "grant" };
  await writeStore(store);
  return NextResponse.json({ showApp: false });
}
