-- Product video support: denormalize the media kind onto product_images so the
-- PDP gallery can branch image↔video without a join, and record a clip's length
-- on media_assets. Both columns are additive + backfilled with safe defaults, so
-- the migration is non-breaking for existing rows.

-- AlterTable
ALTER TABLE "product_images" ADD COLUMN "type" "MediaType" NOT NULL DEFAULT 'image';

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN "duration" INTEGER;
