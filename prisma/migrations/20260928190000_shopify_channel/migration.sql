-- Shopify wholesale channel. Additive. Existing accounts are unchanged.
BEGIN;

CREATE TYPE "ShopifyAddressSource" AS ENUM ('WEBHOOK', 'CUSTOM_APP_TOKEN');
CREATE TYPE "ShopifyAddressTestStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');
CREATE TYPE "ChannelPublishScope" AS ENUM ('ONE', 'SELECTION', 'CATEGORY', 'CATALOG');
CREATE TYPE "ChannelPublishStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ChannelOrderStatus" AS ENUM (
  'HELD',
  'QUEUED',
  'NEEDS_ATTENTION',
  'CHARGED',
  'SUBMITTED',
  'PICKING',
  'SHIPPED',
  'FAILED',
  'REFUNDED'
);

CREATE TABLE "shopify_connections" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "shop_domain" TEXT NOT NULL,
  "access_token_enc" TEXT,
  "order_token_enc" TEXT,
  "address_source" "ShopifyAddressSource" NOT NULL DEFAULT 'WEBHOOK',
  "address_test_status" "ShopifyAddressTestStatus" NOT NULL DEFAULT 'PENDING',
  "webhook_token" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "scopes" TEXT NOT NULL DEFAULT '',
  "primary_location_id" TEXT,
  "disconnected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shopify_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seller_payment_methods" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT NOT NULL,
  "stripe_payment_method_id" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_listings" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "bc_product_id" INTEGER NOT NULL,
  "bc_variant_id" INTEGER NOT NULL DEFAULT 0,
  "shopify_product_id" TEXT NOT NULL,
  "shopify_variant_id" TEXT NOT NULL,
  "shopify_inventory_item_id" TEXT,
  "seller_price" DECIMAL(10,2) NOT NULL,
  "seller_sku" TEXT,
  "internal_sku" TEXT,
  "title_snapshot" TEXT NOT NULL,
  "removed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_publish_jobs" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "requested_by_user_id" TEXT NOT NULL,
  "requested_by_email" TEXT NOT NULL,
  "scope" "ChannelPublishScope" NOT NULL,
  "status" "ChannelPublishStatus" NOT NULL DEFAULT 'QUEUED',
  "added_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "cursor" TEXT,
  "detail" JSONB,
  "email_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_publish_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_orders" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "shopify_order_id" TEXT NOT NULL,
  "shopify_order_name" TEXT NOT NULL,
  "stripe_charge_id" TEXT,
  "bc_order_id" INTEGER,
  "status" "ChannelOrderStatus" NOT NULL DEFAULT 'HELD',
  "tier" TEXT,
  "sold_for" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "goods_charged" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "shipping_charged" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "amount_charged" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "amount_refunded" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "ship_to" JSONB,
  "lines" JSONB,
  "checkout_note" TEXT,
  "carrier" TEXT,
  "tracking_number" TEXT,
  "tracking_url" TEXT,
  "error" TEXT,
  "attention_note" TEXT,
  "charge_attempts" INTEGER NOT NULL DEFAULT 0,
  "reminded_at" TIMESTAMP(3),
  "charged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopify_terms_acceptances" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shopify_terms_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_connections_shop_domain_key" ON "shopify_connections"("shop_domain");
CREATE UNIQUE INDEX "shopify_connections_webhook_token_key" ON "shopify_connections"("webhook_token");
CREATE INDEX "shopify_connections_account_id_idx" ON "shopify_connections"("account_id");

CREATE UNIQUE INDEX "seller_payment_methods_account_id_key" ON "seller_payment_methods"("account_id");

CREATE UNIQUE INDEX "channel_listings_connection_id_bc_product_id_bc_variant_id_key"
  ON "channel_listings"("connection_id", "bc_product_id", "bc_variant_id");
CREATE INDEX "channel_listings_account_id_idx" ON "channel_listings"("account_id");

CREATE INDEX "channel_publish_jobs_status_created_at_idx" ON "channel_publish_jobs"("status", "created_at");
CREATE INDEX "channel_publish_jobs_connection_id_status_idx" ON "channel_publish_jobs"("connection_id", "status");

CREATE UNIQUE INDEX "channel_orders_connection_id_shopify_order_id_key"
  ON "channel_orders"("connection_id", "shopify_order_id");
CREATE INDEX "channel_orders_account_id_created_at_idx" ON "channel_orders"("account_id", "created_at");
CREATE INDEX "channel_orders_status_idx" ON "channel_orders"("status");

CREATE UNIQUE INDEX "shopify_terms_acceptances_account_id_version_key"
  ON "shopify_terms_acceptances"("account_id", "version");

ALTER TABLE "shopify_connections"
  ADD CONSTRAINT "shopify_connections_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_payment_methods"
  ADD CONSTRAINT "seller_payment_methods_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_listings"
  ADD CONSTRAINT "channel_listings_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_listings"
  ADD CONSTRAINT "channel_listings_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "shopify_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_publish_jobs"
  ADD CONSTRAINT "channel_publish_jobs_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_publish_jobs"
  ADD CONSTRAINT "channel_publish_jobs_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "shopify_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_orders"
  ADD CONSTRAINT "channel_orders_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_orders"
  ADD CONSTRAINT "channel_orders_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "shopify_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shopify_terms_acceptances"
  ADD CONSTRAINT "shopify_terms_acceptances_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
