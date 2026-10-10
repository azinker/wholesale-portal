import { bc, type BCProduct } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { sendCatalogExportEmail } from "@/lib/email";
import { uploadToClean } from "@/lib/storage";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "./money";
import { zipStore } from "./zip-store";

export const EXPORT_LIMIT = 80;

const COLUMNS = [
  "Title",
  "Description",
  "Your SKU",
  "Your selling price",
  "Wholesale cost",
  "Retail price",
  "Quantity available",
  "Image files",
  "Product page",
] as const;

export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

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

function howToCsv(email: string, couponCode: string | null): string {
  const coupon = couponCode
    ? `Your coupon right now is ${couponCode}. Enter it at checkout.`
    : "Your coupon shows on your wholesale dashboard once your account qualifies. Enter it at checkout.";
  const rows = [
    ["Column", "What it is", "What you do"],
    ["Title", "The product name shoppers see.", "You can keep it or rewrite it for your store."],
    ["Description", "The product description, without website formatting.", "You can keep it or rewrite it."],
    ["Your SKU", "Your own product code.", "This starts blank on purpose. Type the SKU you want on your site."],
    ["Your selling price", "The price your customer pays you.", "This starts blank. Type the price you want to charge."],
    ["Wholesale cost", "What you pay us for one item, at your discount today.", "This is your cost. It is not the price you charge your customer."],
    ["Retail price", "The price on www.theperfectpart.net before your discount.", "Use this to compare. Your coupon takes your discount off this price."],
    ["Quantity available", "How many we can ship right now.", "Stock changes. Check again before a big promotion."],
    ["Image files", "The picture files for this product.", "Open the images folder, then the folder with this product's title. The file names in this column match the pictures inside."],
    ["Product page", "The page on www.theperfectpart.net.", "When a customer buys from you, place the order on this site."],
    ["", "", ""],
    ["About this file", "This puts the catalog on your own site.", "It does not connect orders. A sale on your site does not order from us by itself."],
    ["How you order", "Purchases are made on www.theperfectpart.net.", `Sign in with ${email}, the same email as your wholesale dashboard. ${coupon}`],
    ["Images", "The images folder holds one folder per product.", "Each folder is named with the product title. That product's pictures are inside it."],
    ["Your SKU", "The SKU column starts blank.", "Type your own SKU before you import the file."],
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
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

function productRows(product: BCProduct): Array<{ title: string; description: string; retail: number; qty: number }> {
  const description = plainText(product.description || "");
  const variants = (product.variants || []).filter((variant) => (variant.option_values || []).length > 0);
  if (variants.length === 0) {
    return [{
      title: product.name,
      description,
      retail: Number(product.calculated_price || product.price || 0),
      qty: product.inventory_level || 0,
    }];
  }
  return variants.map((variant) => {
    const options = (variant.option_values || []).map((option) => option.label).filter(Boolean).join(" / ");
    return {
      title: options ? `${product.name} — ${options}` : product.name,
      description,
      retail: Number(variant.calculated_price || variant.price || product.price || 0),
      qty: variant.inventory_level || 0,
    };
  });
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
    const listingRows = [COLUMNS.join(",")];
    const usedFolders = new Map<string, number>();
    let done = 0;

    for (const id of ids) {
      const product = byId.get(id);
      done += 1;
      if (!product) {
        await db.catalogExport.update({ where: { id: job.id }, data: { done } });
        continue;
      }
      const names: string[] = [];
      const folder = uniqueFolder(product.name, usedFolders);
      const images = (product.images || []).slice(0, 6);
      for (let index = 0; index < images.length; index++) {
        const image = images[index];
        const url = image.url_zoom || image.url_standard;
        if (!url) continue;
        const downloaded = await downloadImage(url);
        if (!downloaded) continue;
        const name = `images/${folder}/${index + 1}.${extensionFor(url, downloaded.type)}`;
        names.push(name);
        files.push({ name, data: downloaded.data });
      }
      const page = product.custom_url?.url
        ? `https://theperfectpart.net${product.custom_url.url.startsWith("/") ? "" : "/"}${product.custom_url.url}`
        : "https://theperfectpart.net";
      for (const row of productRows(product)) {
        listingRows.push(
          [
            row.title,
            row.description,
            "",
            "",
            wholesaleUnitCost(row.retail, percent).toFixed(2),
            row.retail.toFixed(2),
            String(row.qty),
            names.join("; "),
            page,
          ].map(csvCell).join(",")
        );
      }
      await db.catalogExport.update({ where: { id: job.id }, data: { done } });
    }

    const promo = await db.promotionRecord.findFirst({
      where: { accountId: job.accountId, enabled: true },
      select: { code: true },
    });
    files.unshift(
      { name: "listings.csv", data: Buffer.from(listingRows.join("\n"), "utf8") },
      { name: "how-to-use.csv", data: Buffer.from(howToCsv(job.account.email, promo?.code || null), "utf8") }
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
