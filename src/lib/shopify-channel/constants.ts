export const SHOPIFY_CONNECT_MAINTENANCE = false;
export const SHOPIFY_CHANNEL_TERMS_VERSION = "1";
export const SHOPIFY_APP_NAME = "The Perfect Part Wholesale";
export const STATEMENT_DESCRIPTOR = "THE PERFECT PART";
export const INTERNATIONAL_SHIPPING_USD = 18.99;
export const MAX_SHOPS_PER_ACCOUNT = 5;
export const SHOPIFY_API_VERSION = "2026-01";
export const WHOLESALE_NOTICE_EMAIL = "wholesale@theperfectpart.net";
/** OAuth state marker for installs that start from Shopify rather than from a signed-in wholesaler. */
export const INSTALL_STATE_ACCOUNT = "shopify-install";

export const SHOPIFY_OAUTH_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_orders",
].join(",");
