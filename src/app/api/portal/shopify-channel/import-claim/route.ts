import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/portal-auth";
import { decideImportClaims, importClaimView, reopenImportClaims } from "@/lib/shopify-channel/import-claim";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  const user = auth.user;
  const account = user?.wholesaleAccount;
  if (!user || !account) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });
  if (!(await channelVisibility(user.email)).visible) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { connectionId?: string; decision?: string; fresh?: boolean; reopen?: boolean } | null;
  const connectionId = body?.connectionId || "";
  if (!connectionId) return NextResponse.json({ error: "Missing store" }, { status: 400 });
  try {
    if (body?.decision === "yes" || body?.decision === "no") {
      const result = await decideImportClaims(connectionId, account.id, body.decision);
      if (!result) return NextResponse.json({ error: "That store is not connected" }, { status: 404 });
      return NextResponse.json(result);
    }
    const view = body?.reopen
      ? await reopenImportClaims(connectionId, account.id)
      : await importClaimView(connectionId, account.id, Boolean(body?.fresh));
    if (!view) return NextResponse.json({ error: "That store is not connected" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error) {
    console.error("shopify import claim failed", error instanceof Error ? error.message : "claim failed");
    return NextResponse.json({ error: "We could not look through this store just now." }, { status: 500 });
  }
}
