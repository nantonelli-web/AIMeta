-- =====================================================================
-- 0007 — Google Ads support
-- Adds `source` column to mait_ads_external (meta | google)
-- Adds Google-specific fields to mait_competitors
-- =====================================================================

-- 1. Add source column to ads (default 'meta' for all existing rows)
alter table mait_ads_external
  add column if not exists source text not null default 'meta';

-- 2. Update unique constraint to include source
--    (allows same ad_archive_id from different sources)
alter table mait_ads_external
  drop constraint if exists mait_ads_external_workspace_id_ad_archive_id_key;

alter table mait_ads_external
  add constraint mait_ads_external_ws_adid_source_key
    unique (workspace_id, ad_archive_id, source);

-- 3. Index on source for filtered queries
create index if not exists idx_mait_ads_external_source
  on mait_ads_external(source);

-- 4. Add Google Ads fields to competitors
alter table mait_competitors
  add column if not exists google_advertiser_id text,
  add column if not exists google_domain text;
