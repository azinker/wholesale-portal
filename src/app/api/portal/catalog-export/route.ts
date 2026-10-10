import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { EXPORT_LIMIT, runCatalogExport } from "@/lib/shopify-channel/catalog-export";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("view_channel");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });
  }
  if (!(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { productIds?: number[] } | null;
  const productIds = [...new Set((body?.productIds || []).map((id) => Number(id)))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, EXPORT_LIMIT);
  if (productIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one product" }, { status: 400 });
  }
  const running = await db.catalogExport.findFirst({
    where: { accountId: auth.user.wholesaleAccount.id, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (running) {
    return NextResponse.json({ error: "An export is already running", id: running.id }, { status: 409 });
  }
  const job = await db.catalogExport.create({
    data: {
      accountId: auth.user.wholesaleAccount.id,
      status: "QUEUED",
      total: productIds.length,
      productIds,
    },
  });
  after(() => runCatalogExport(job.id));
  return NextResponse.json({ id: job.id, total: productIds.length });
}
