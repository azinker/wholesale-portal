import { NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/portal-auth";

export async function requireExportAccount() {
  const auth = await requirePortalAccount("view_channel");
  const account = auth.user?.wholesaleAccount;
  if (!account) {
    return { account: null, response: NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status }) };
  }
  if (account.status !== "APPROVED" || account.partnerType === "AFFILIATE_PUBLISHER") {
    return { account: null, response: NextResponse.json({ error: "Not available" }, { status: 403 }) };
  }
  return { account, response: null };
}
