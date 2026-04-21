-- =====================================================================
-- MAIT — Instagram profile snapshot on the competitor row
-- Stores followers/following/posts counts + bio as a JSONB blob, kept
-- fresh by the Instagram scan route.
-- =====================================================================

alter table mait_competitors
  add column if not exists instagram_profile jsonb;
