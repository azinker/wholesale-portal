import { mkdir, readFile, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "/tmp/shopify-install-gate.json";
const WINDOW_MS = 45 * 60 * 1000;

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

/** First install visit for a shop is the grant screen. Later visits in the same check open the app page. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const shop = typeof body?.shop === "string" ? body.shop : "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(shop)) {
    return NextResponse.json({ showApp: false });
  }
  const now = Date.now();
  const store = await readStore();
  const current = store[shop];
  const fresh = current && now - current.at < WINDOW_MS && current.phase === "grant";
  if (fresh) return NextResponse.json({ showApp: true });
  store[shop] = { at: now, phase: "grant" };
  await writeStore(store);
  return NextResponse.json({ showApp: false });
}
