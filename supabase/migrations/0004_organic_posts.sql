-- =====================================================================
-- MAIT — Instagram organic posts + instagram_username on competitors
-- =====================================================================

-- Add instagram_username column to competitors
alter table mait_competitors add column if not exists instagram_username text;

-- ---------- ORGANIC POSTS ----------
create table if not exists mait_organic_posts (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references mait_workspaces(id) on delete cascade,
  competitor_id    uuid references mait_competitors(id) on delete cascade,
  platform         text not null, -- 'instagram' or 'facebook'
  post_id          text not null, -- platform-specific ID
  post_url         text,
  post_type        text, -- 'Video', 'Image', 'Sidecar', 'Reel'
  caption          text,
  display_url      text, -- main image/thumbnail URL
  video_url        text,
  likes_count      integer default 0,
  comments_count   integer default 0,
  shares_count     integer default 0,
  video_views      integer default 0,
  video_play_count integer default 0,
  hashtags         text[] default '{}',
  mentions         text[] default '{}',
  tagged_users     text[] default '{}',
  posted_at        timestamptz,
  raw_data         jsonb,
  created_at       timestamptz not null default now(),
  unique (workspace_id, platform, post_id)
);

create index if not exists idx_mait_organic_posts_workspace on mait_organic_posts(workspace_id);
create index if not exists idx_mait_organic_posts_competitor on mait_organic_posts(competitor_id);
create index if not exists idx_mait_organic_posts_posted on mait_organic_posts(posted_at desc);
create index if not exists idx_mait_organic_posts_platform on mait_organic_posts(platform);

-- RLS
alter table mait_organic_posts enable row level security;

drop policy if exists "organic_posts_select" on mait_organic_posts;
create policy "organic_posts_select" on mait_organic_posts for select
  using (workspace_id = mait_current_workspace() or mait_current_role() = 'super_admin');

drop policy if exists "organic_posts_write" on mait_organic_posts;
create policy "organic_posts_write" on mait_organic_posts for all
  using (workspace_id = mait_current_workspace() and mait_current_role() in ('super_admin','admin'))
  with check (workspace_id = mait_current_workspace() and mait_current_role() in ('super_admin','admin'));

-- Grants
grant all on mait_organic_posts to anon, authenticated, service_role;
