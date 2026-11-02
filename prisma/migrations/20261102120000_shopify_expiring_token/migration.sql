ALTER TABLE "shopify_connections" ADD COLUMN IF NOT EXISTS "refresh_token_enc" TEXT;
ALTER TABLE "shopify_connections" ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);
