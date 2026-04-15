-- =====================================================================
-- MAIT — Comparison caching table
-- Stores cached results of brand comparisons (technical, copy, visual)
-- to avoid redundant API/AI calls.
-- =====================================================================

create table mait_comparisons (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references mait_workspaces(id) on delete cascade,
  competitor_ids  text[] not null,
  locale          text not null default 'it',
  technical_data  jsonb,
  copy_analysis   jsonb,
  visual_analysis jsonb,
  stale           boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index idx_mait_comparisons_key on mait_comparisons(workspace_id, competitor_ids, locale);
create index idx_mait_comparisons_workspace on mait_comparisons(workspace_id);

-- RLS
alter table mait_comparisons enable row level security;

drop policy if exists "comparisons_select" on mait_comparisons;
create policy "comparisons_select" on mait_comparisons for select
  using (workspace_id = mait_current_workspace() or mait_current_role() = 'super_admin');

drop policy if exists "comparisons_write" on mait_comparisons;
create policy "comparisons_write" on mait_comparisons for all
  using (workspace_id = mait_current_workspace())
  with check (workspace_id = mait_current_workspace());

-- Grants (same pattern as other mait_ tables)
grant select, insert, update, delete on mait_comparisons to authenticated;
