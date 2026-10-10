export const EXPORT_FORMATS = ["manual", "shopify", "bigcommerce", "woocommerce"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function parseExportFormat(value: unknown): ExportFormat {
  return EXPORT_FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : "manual";
}

export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function exportFormatLabel(format: ExportFormat): string {
  if (format === "shopify") return "Shopify";
  if (format === "bigcommerce") return "BigCommerce";
  if (format === "woocommerce") return "WooCommerce";
  return "Manual";
}

export type ExportImage = { file: string; url: string };
export type ExportOption = { name: string; value: string };
export type ExportVariant = {
  options: ExportOption[];
  retail: number;
  cost: number;
  qty: number;
};
export type ExportItem = {
  name: string;
  handle: string;
  descriptionHtml: string;
  descriptionText: string;
  page: string;
  images: ExportImage[];
  variants: ExportVariant[];
};

function money(value: number): string {
  return value.toFixed(2);
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function optionAt(variant: ExportVariant, index: number): ExportOption | undefined {
  return variant.options[index];
}

const SHOPIFY_COLUMNS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Variant Barcode",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "Gift Card",
  "Variant Weight Unit",
  "Cost per item",
  "Status",
];

function shopifyCsv(items: ExportItem[]): string {
  const rows: string[][] = [SHOPIFY_COLUMNS];
  for (const item of items) {
    const variants = item.variants.length ? item.variants : [{ options: [], retail: 0, cost: 0, qty: 0 }];
    variants.forEach((variant, index) => {
      const first = index === 0;
      const image = first ? item.images[0] : undefined;
      const options = variant.options.length ? variant.options : [{ name: "Title", value: "Default Title" }];
      rows.push([
        item.handle,
        first ? item.name : "",
        first ? item.descriptionHtml : "",
        "",
        "",
        "",
        "FALSE",
        optionAt({ ...variant, options }, 0)?.name || "",
        optionAt({ ...variant, options }, 0)?.value || "",
        optionAt({ ...variant, options }, 1)?.name || "",
        optionAt({ ...variant, options }, 1)?.value || "",
        optionAt({ ...variant, options }, 2)?.name || "",
        optionAt({ ...variant, options }, 2)?.value || "",
        "",
        "shopify",
        String(variant.qty),
        "deny",
        "manual",
        money(variant.retail),
        "",
        "TRUE",
        "TRUE",
        "",
        image?.url || "",
        image ? "1" : "",
        image ? item.name : "",
        "FALSE",
        "lb",
        money(variant.cost),
        "draft",
      ]);
    });
    item.images.slice(1).forEach((image, index) => {
      const row = SHOPIFY_COLUMNS.map(() => "");
      row[0] = item.handle;
      row[SHOPIFY_COLUMNS.indexOf("Image Src")] = image.url;
      row[SHOPIFY_COLUMNS.indexOf("Image Position")] = String(index + 2);
      row[SHOPIFY_COLUMNS.indexOf("Image Alt Text")] = item.name;
      rows.push(row);
    });
  }
  return rowsToCsv(rows);
}

const WOO_COLUMNS = [
  "Type",
  "SKU",
  "Name",
  "Published",
  "Is featured?",
  "Visibility in catalog",
  "Short description",
  "Description",
  "Tax status",
  "In stock?",
  "Stock",
  "Backorders allowed?",
  "Sold individually?",
  "Regular price",
  "Sale price",
  "Categories",
  "Tags",
  "Images",
  "Parent",
  "Position",
  "Attribute 1 name",
  "Attribute 1 value(s)",
  "Attribute 1 visible",
  "Attribute 1 global",
  "Attribute 2 name",
  "Attribute 2 value(s)",
  "Attribute 2 visible",
  "Attribute 2 global",
  "Attribute 3 name",
  "Attribute 3 value(s)",
  "Attribute 3 visible",
  "Attribute 3 global",
];

function wooAttributeCells(names: string[], values: string[], parent: boolean): string[] {
  const cells: string[] = [];
  for (let index = 0; index < 3; index++) {
    cells.push(names[index] || "", values[index] || "", names[index] ? "1" : "", names[index] && parent ? "0" : "");
  }
  return cells;
}

function wooCsv(items: ExportItem[]): string {
  const rows: string[][] = [WOO_COLUMNS];
  for (const item of items) {
    const images = item.images.map((image) => image.url).join(", ");
    const hasOptions = item.variants.some((variant) => variant.options.length > 0);
    if (!hasOptions) {
      const variant = item.variants[0] || { options: [], retail: 0, cost: 0, qty: 0 };
      rows.push([
        "simple",
        "",
        item.name,
        "0",
        "0",
        "visible",
        "",
        item.descriptionHtml,
        "taxable",
        variant.qty > 0 ? "1" : "0",
        String(variant.qty),
        "0",
        "0",
        money(variant.retail),
        "",
        "",
        "",
        images,
        "",
        "0",
        ...wooAttributeCells([], [], false),
      ]);
      continue;
    }
    const names = item.variants[0]?.options.map((option) => option.name) || [];
    const grouped = names.map((name, index) => {
      const values = [...new Set(item.variants.map((variant) => variant.options[index]?.value).filter(Boolean))];
      return values.join(", ");
    });
    rows.push([
      "variable",
      item.handle,
      item.name,
      "0",
      "0",
      "visible",
      "",
      item.descriptionHtml,
      "taxable",
      "",
      "",
      "0",
      "0",
      "",
      "",
      "",
      "",
      images,
      "",
      "0",
      ...wooAttributeCells(names, grouped, true),
    ]);
    item.variants.forEach((variant, index) => {
      rows.push([
        "variation",
        "",
        "",
        "0",
        "0",
        "visible",
        "",
        "",
        "taxable",
        variant.qty > 0 ? "1" : "0",
        String(variant.qty),
        "0",
        "0",
        money(variant.retail),
        "",
        "",
        "",
        "",
        item.handle,
        String(index),
        ...wooAttributeCells(names, variant.options.map((option) => option.value), false),
      ]);
    });
  }
  return rowsToCsv(rows);
}

const BC_COLUMNS = [
  "Item",
  "ID",
  "Name",
  "Type",
  "SKU",
  "Description",
  "Price",
  "Cost Price",
  "Retail Price",
  "Sale Price",
  "Current Stock",
  "Inventory Tracking",
  "Is Visible",
  "Free Shipping",
  "Options",
  "Variant Image URL",
  "Image URL (Import)",
  "Image Description",
  "Image is Thumbnail",
  "Image Sort Order",
];

function bcOptions(options: ExportOption[]): string {
  return options
    .slice(0, 3)
    .map((option) => `Type=Dropdown|Name=${option.name.replace(/[|=]/g, " ")}|Value=${option.value.replace(/[|=]/g, " ")}`)
    .join(" ");
}

function bcCsv(items: ExportItem[]): string {
  const rows: string[][] = [BC_COLUMNS];
  for (const item of items) {
    const hasOptions = item.variants.some((variant) => variant.options.length > 0);
    const base = item.variants[0] || { options: [], retail: 0, cost: 0, qty: 0 };
    const stock = hasOptions ? "" : String(base.qty);
    rows.push([
      "Product",
      "",
      item.name,
      "physical",
      "",
      item.descriptionHtml,
      money(base.retail),
      money(base.cost),
      money(base.retail),
      "",
      stock,
      hasOptions ? "variant" : "product",
      "FALSE",
      "FALSE",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    if (hasOptions) {
      for (const variant of item.variants) {
        rows.push([
          "Variant",
          "",
          "",
          "",
          "",
          "",
          money(variant.retail),
          money(variant.cost),
          money(variant.retail),
          "",
          String(variant.qty),
          "",
          "",
          "",
          bcOptions(variant.options),
          "",
          "",
          "",
          "",
          "",
        ]);
      }
    }
    item.images.forEach((image, index) => {
      rows.push([
        "Image",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        image.url,
        item.name,
        index === 0 ? "TRUE" : "FALSE",
        String(index),
      ]);
    });
  }
  return rowsToCsv(rows);
}

function manualCsv(items: ExportItem[]): string {
  const rows: string[][] = [[
    "Title",
    "Description",
    "Your SKU",
    "Your selling price",
    "Wholesale cost",
    "Retail price",
    "Quantity available",
    "Image files",
    "Product page",
  ]];
  for (const item of items) {
    const files = item.images.map((image) => image.file).join("; ");
    const variants = item.variants.length ? item.variants : [{ options: [], retail: 0, cost: 0, qty: 0 }];
    for (const variant of variants) {
      const optionLabel = variant.options.map((option) => option.value).filter(Boolean).join(" / ");
      rows.push([
        optionLabel ? `${item.name} — ${optionLabel}` : item.name,
        item.descriptionText,
        "",
        "",
        money(variant.cost),
        money(variant.retail),
        String(variant.qty),
        files,
        item.page,
      ]);
    }
  }
  return rowsToCsv(rows);
}

export function buildListingCsv(format: ExportFormat, items: ExportItem[]): string {
  if (format === "shopify") return shopifyCsv(items);
  if (format === "bigcommerce") return bcCsv(items);
  if (format === "woocommerce") return wooCsv(items);
  return manualCsv(items);
}

export function howToCsv(format: ExportFormat, email: string, couponCode: string | null): string {
  const coupon = couponCode
    ? `Your coupon right now is ${couponCode}. Enter it at checkout.`
    : "Your coupon shows on your wholesale dashboard once your account qualifies. Enter it at checkout.";
  const formatNote = format === "manual"
    ? "This is a simple spreadsheet. It is not formatted for one website."
    : `This file uses ${exportFormatLabel(format)} product import columns. Import it from that site's product import page.`;
  const priceNote = format === "manual"
    ? "Your selling price starts blank. Type the price you want to charge."
    : "The price starts as today's price on www.theperfectpart.net so the file can import. Change it to what you charge before you import.";
  const skuNote = format === "woocommerce"
    ? "Your SKU starts blank. A product with options uses a temporary code made from the product name so the options stay grouped. Change that code to your own SKU."
    : "Your SKU starts blank. Type the SKU you want on your site.";
  const rows = [
    ["Topic", "What it means", "What you do"],
    ["Format", formatNote, "Manual is the simple file. Shopify, BigCommerce, and WooCommerce match that site's import."],
    ["Your SKU", "Your own product code.", skuNote],
    ["Price", "The price your customer pays you.", priceNote],
    ["Wholesale cost", "What you pay us for one item, at your discount today.", "This is your cost. It is not the price you charge your customer. On Shopify this is Cost per item. On BigCommerce this is Cost Price."],
    ["Pictures", "Each product has its own folder inside images, named with the product title.", "The spreadsheet also lists a public picture link when that site can import pictures from a link."],
    ["No connection", "This file puts the catalog on your site.", "A sale on your site does not order from us by itself."],
    ["How you order", "Purchases are made on www.theperfectpart.net.", `Sign in with ${email}, the same email as your wholesale dashboard. ${coupon}`],
  ];
  return rowsToCsv(rows);
}
