-- Update SiteSetting.contactEmail column default: the old hello@googlywoogly.art
-- mailbox does not exist; the live support inbox is the Gmail address. Only the
-- column DEFAULT changes here (existing rows are untouched).
ALTER TABLE "site_settings" ALTER COLUMN "contactEmail" SET DEFAULT 'googlywooglyarrtt@gmail.com';
