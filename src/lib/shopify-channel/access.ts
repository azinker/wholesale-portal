import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { channelVisibility } from "./visibility";

export async function channelTablesReady(): Promise<boolean> {
  try {
    await db.channelOrder.count();
    return true;
  } catch {
    return false;
  }
}

export async function requireChannelAccount() {
  const user = await getUser();
  if (!user) redirect("/");
  const access = await channelVisibility(user.email);
  if (!access.visible) notFound();
  const account = user.wholesaleAccount;
  if (!account || account.partnerType !== "DROPSHIPPER" || account.status !== "APPROVED") {
    notFound();
  }
  const schemaReady = await channelTablesReady();
  return { user, account, preview: access.preview, enabled: access.enabled, schemaReady };
}
