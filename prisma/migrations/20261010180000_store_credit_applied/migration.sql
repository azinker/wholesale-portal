ALTER TABLE "channel_orders" ADD COLUMN IF NOT EXISTS "store_credit_applied" DECIMAL(10,2) NOT NULL DEFAULT 0;
