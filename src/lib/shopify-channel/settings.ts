import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const SETTINGS_KEY = "shopifyChannelEnabled";

export async function isShopifyChannelEnabled(): Promise<boolean> {
  try {
    const row = await db.globalSettings.findUnique({ where: { id: "global" } });
    const settings = row?.settings as Record<string, unknown> | null;
    return settings?.[SETTINGS_KEY] === true;
  } catch {
    return false;
  }
}

export async function setShopifyChannelEnabled(enabled: boolean): Promise<void> {
  const row = await db.globalSettings.findUnique({ where: { id: "global" } });
  const existing = (row?.settings as Record<string, unknown>) || {};
  const merged = JSON.parse(
    JSON.stringify({ ...existing, [SETTINGS_KEY]: enabled })
  ) as Prisma.InputJsonValue;
  await db.globalSettings.upsert({
    where: { id: "global" },
    create: { id: "global", settings: merged },
    update: { settings: merged },
  });
}
