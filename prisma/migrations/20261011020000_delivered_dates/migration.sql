ALTER TYPE "ChannelOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TABLE "channel_orders" ADD COLUMN IF NOT EXISTS "shipped_at" TIMESTAMP(3);
ALTER TABLE "channel_orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
UPDATE "channel_orders" SET "shipped_at" = "updated_at" WHERE "status" = 'SHIPPED' AND "shipped_at" IS NULL;
