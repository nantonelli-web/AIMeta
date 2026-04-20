-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ads_ext_workspace_status ON mait_ads_external(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_ads_ext_competitor ON mait_ads_external(competitor_id, start_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ads_ext_workspace_source ON mait_ads_external(workspace_id, source);
CREATE INDEX IF NOT EXISTS idx_organic_posts_competitor ON mait_organic_posts(competitor_id, posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_competitors_workspace ON mait_competitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collections_workspace ON mait_collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collection_ads_collection ON mait_collection_ads(collection_id);
CREATE INDEX IF NOT EXISTS idx_credits_history_user ON mait_credits_history(user_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_workspace ON mait_comparisons(workspace_id, competitor_ids, locale);
