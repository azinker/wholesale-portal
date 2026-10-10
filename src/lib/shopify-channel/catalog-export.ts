import { bc, type BCProduct } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { sendCatalogExportEmail } from "@/lib/email";
import { uploadToClean } from "@/lib/storage";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { buildListingCsv, howToCsv, parseExportFormat, type ExportFormat, type ExportItem } from "./export-formats";
import { wholesaleUnitCost } from "./money";
import { zipStore } from "./zip-store";

export const EXPORT_LIMIT = 80;
export { csvCell } from "./export-formats";

export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function folderTitle(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 90);
  return cleaned || "Product";
}

function uniqueFolder(title: string, used: Map<string, number>): string {
  const base = folderTitle(title);
  const key = base.toLowerCase();
  const count = used.get(key) || 0;
  used.set(key, count + 1);
  if (count === 0) return base;
  const suffix = ` (${count + 1})`;
  return `${base.slice(0, 90 - suffix.length)}${suffix}`;
}

function extensionFor(url: string, type: string | null): string {
  const fromType = type?.includes("png") ? "png" : type?.includes("webp") ? "webp" : type?.includes("gif") ? "gif" : "";
  if (fromType) return fromType;
  const match = url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

async function downloadImage(url: string): Promise<{ data: Buffer; type: string | null } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length < 32 || data.length > 8_000_000) return null;
    return { data, type: res.headers.get("content-type") };
  } catch {
    return null;
  }
}

function productHandle(name: string, used: Map<string, number>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";
  const count = used.get(base) || 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function exportItem(product: BCProduct, percent: number, images: ExportItem["images"], handle: string): ExportItem {
  const html = (product.description || "").replace(/<script[\s\S]*?<\/script>/gi, " ").trim();
  const variants = (product.variants || []).filter((variant) => (variant.option_values || []).length > 0);
  const mapped = (variants.length ? variants : [null]).map((variant) => {
    const retail = variant
      ? Number(variant.calculated_price || variant.price || product.price || 0)
      : Number(product.calculated_price || product.price || 0);
    return {
      options: (variant?.option_values || [])
        .map((option) => ({ name: option.option_display_name || "Option", value: option.label || "" }))
        .filter((option) => option.value)
        .slice(0, 3),
      retail,
      cost: wholesaleUnitCost(retail, percent),
      qty: variant ? variant.inventory_level || 0 : product.inventory_level || 0,
    };
  });
  const page = product.custom_url?.url
    ? `https://www.theperfectpart.net${product.custom_url.url.startsWith("/") ? "" : "/"}${product.custom_url.url}`
    : "https://www.theperfectpart.net";
  return {
    name: product.name,
    handle,
    descriptionHtml: html,
    descriptionText: plainText(html),
    page,
    images,
    variants: mapped,
  };
}

export async function runCatalogExport(exportId: string): Promise<void> {
  const claimed = await db.catalogExport.updateMany({
    where: { id: exportId, status: "QUEUED" },
    data: { status: "RUNNING" },
  });
  if (claimed.count !== 1) return;

  const job = await db.catalogExport.findUnique({
    where: { id: exportId },
    include: { account: true },
  });
  if (!job) return;
  const ids = Array.isArray(job.productIds) ? job.productIds.map((id) => Number(id)).filter((id) => id > 0).slice(0, EXPORT_LIMIT) : [];
  const format: ExportFormat = parseExportFormat(job.format);

  try {
    const welcome = await loadWelcomeConfig();
    const earned = await getTierDiscountPercent(job.account.lastTier);
    const percent =
      isWelcomeActive(job.account.welcomeExpiresAt) && welcome.enabled && welcome.discount > earned
        ? welcome.discount
        : earned;
    const products = await bc().getProductsByIds(ids);
    const byId = new Map(products.map((product) => [product.id, product]));
    const files: Array<{ name: string; data: Buffer }> = [];
    const items: ExportItem[] = [];
    const usedFolders = new Map<string, number>();
    const usedHandles = new Map<string, number>();
    let done = 0;

    for (const id of ids) {
      const product = byId.get(id);
      done += 1;
      if (!product) {
        await db.catalogExport.update({ where: { id: job.id }, data: { done } });
        continue;
      }
      const savedImages: ExportItem["images"] = [];
      const folder = uniqueFolder(product.name, usedFolders);
      const pictures = (product.images || []).slice(0, 6);
      for (let index = 0; index < pictures.length; index++) {
        const image = pictures[index];
        const url = image.url_zoom || image.url_standard;
        if (!url) continue;
        const downloaded = await downloadImage(url);
        if (!downloaded) continue;
        const name = `images/${folder}/${savedImages.length + 1}.${extensionFor(url, downloaded.type)}`;
        savedImages.push({ file: name, url });
        files.push({ name, data: downloaded.data });
      }
      items.push(exportItem(product, percent, savedImages, productHandle(product.name, usedHandles)));
      await db.catalogExport.update({ where: { id: job.id }, data: { done } });
    }

    const promo = await db.promotionRecord.findFirst({
      where: { accountId: job.accountId, enabled: true },
      select: { code: true },
    });
    files.unshift(
      { name: "listings.csv", data: Buffer.from(buildListingCsv(format, items), "utf8") },
      { name: "how-to-use.csv", data: Buffer.from(howToCsv(format, job.account.email, promo?.code || null), "utf8") }
    );
    const zip = zipStore(files);
    const key = `catalog-exports/${job.accountId}/${job.id}.zip`;
    await uploadToClean(key, zip, "application/zip");
    await db.catalogExport.update({
      where: { id: job.id },
      data: { status: "READY", fileKey: key, done: ids.length, error: null },
    });
    await sendCatalogExportEmail({
      to: job.account.email,
      count: ids.length,
      exportId: job.id,
      couponCode: promo?.code || null,
      format,
    });
    await db.catalogExport.update({ where: { id: job.id }, data: { emailSentAt: new Date() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    await db.catalogExport.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
  }
}

export async function runNextCatalogExport(): Promise<number> {
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000);
  await db.catalogExport.updateMany({
    where: { status: "RUNNING", fileKey: null, updatedAt: { lt: staleBefore } },
    data: { status: "QUEUED" },
  });
  const next = await db.catalogExport.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) return 0;
  await runCatalogExport(next.id);
  return 1;
}
