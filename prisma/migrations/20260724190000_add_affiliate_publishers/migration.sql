-- Additive publisher-program migration. Existing accounts remain DROPSHIPPER.
BEGIN;

CREATE TYPE "PartnerType" AS ENUM ('DROPSHIPPER', 'AFFILIATE_PUBLISHER');

ALTER TABLE "wholesale_accounts"
  ADD COLUMN "partner_type" "PartnerType" NOT NULL DEFAULT 'DROPSHIPPER',
  ADD COLUMN "awin_publisher_id" TEXT,
  ADD COLUMN "promo_website" TEXT,
  ADD COLUMN "promo_types" JSONB,
  ADD COLUMN "audience_reach" TEXT,
  ADD COLUMN "promo_description" TEXT,
  ADD COLUMN "last_count_14d" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "promotion_records"
  ADD COLUMN "promo_kind" TEXT NOT NULL DEFAULT 'DROPSHIPPER';

DROP INDEX IF EXISTS "promotion_records_account_id_tier_key";
CREATE UNIQUE INDEX "promotion_records_account_id_tier_promo_kind_key"
  ON "promotion_records"("account_id", "tier", "promo_kind");

CREATE TABLE "publisher_order_attributions" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "order_id" INTEGER NOT NULL,
  "coupon_code" TEXT NOT NULL,
  "order_date" TIMESTAMP(3) NOT NULL,
  "subtotal" DECIMAL(10,2),
  "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publisher_order_attributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publisher_order_attributions_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "wholesale_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "publisher_order_attributions_order_id_key"
  ON "publisher_order_attributions"("order_id");
CREATE INDEX "publisher_order_attributions_account_id_order_date_idx"
  ON "publisher_order_attributions"("account_id", "order_date");

COMMIT;
