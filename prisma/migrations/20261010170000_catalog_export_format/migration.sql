ALTER TABLE "catalog_exports" ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'manual';
