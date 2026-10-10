import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EXPORT_LIMIT, runCatalogExport } from "@/lib/shopify-channel/catalog-export";
import { requireExportAccount } from "@/lib/shopify-channel/export-access";
import { parseExportFormat } from "@/lib/shopify-channel/export-formats";

export async function POST(req: NextRequest) {
  const access = await requireExportAccount();
  if (!access.account) return access.response;
  const body = (await req.json().catch(() => null)) as { productIds?: number[]; format?: string } | null;
  const productIds = [...new Set((body?.productIds || []).map((id) => Number(id)))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, EXPORT_LIMIT);
  if (productIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one product" }, { status: 400 });
  }
  const running = await db.catalogExport.findFirst({
    where: { accountId: access.account.id, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (running) {
    return NextResponse.json({ error: "An export is already running", id: running.id }, { status: 409 });
  }
  const job = await db.catalogExport.create({
    data: {
      accountId: access.account.id,
      status: "QUEUED",
      total: productIds.length,
      productIds,
      format: parseExportFormat(body?.format),
    },
  });
  after(() => runCatalogExport(job.id));
  return NextResponse.json({ id: job.id, total: productIds.length });
}
