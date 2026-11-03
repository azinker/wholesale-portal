CREATE TABLE IF NOT EXISTS "channel_import_offers" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "bc_product_id" INTEGER NOT NULL,
  "bc_variant_id" INTEGER NOT NULL DEFAULT 0,
  "shopify_product_id" TEXT NOT NULL,
  "shopify_variant_id" TEXT NOT NULL,
  "shopify_inventory_item_id" TEXT,
  "title" TEXT NOT NULL,
  "seller_price" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_import_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_import_offers_connection_id_shopify_variant_id_key"
  ON "channel_import_offers"("connection_id", "shopify_variant_id");

CREATE INDEX IF NOT EXISTS "channel_import_offers_connection_id_status_idx"
  ON "channel_import_offers"("connection_id", "status");

CREATE TABLE IF NOT EXISTS "channel_import_scans" (
  "connection_id" TEXT NOT NULL,
  "scanned_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_import_scans_pkey" PRIMARY KEY ("connection_id")
);

DO $$ BEGIN
  ALTER TABLE "channel_import_offers"
    ADD CONSTRAINT "channel_import_offers_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "shopify_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "channel_import_scans"
    ADD CONSTRAINT "channel_import_scans_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "shopify_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
