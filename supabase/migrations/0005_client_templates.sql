-- =====================================================================
-- MAIT — Client templates for branded report generation
-- =====================================================================

create table if not exists mait_client_templates (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references mait_workspaces(id) on delete cascade,
  client_id    uuid not null references mait_clients(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  file_type    text not null default 'pptx',
  theme_config jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_mait_client_templates_client on mait_client_templates(client_id);
create index if not exists idx_mait_client_templates_workspace on mait_client_templates(workspace_id);

alter table mait_client_templates enable row level security;

drop policy if exists "templates_select" on mait_client_templates;
create policy "templates_select" on mait_client_templates for select
  using (workspace_id = mait_current_workspace() or mait_current_role() = 'super_admin');

drop policy if exists "templates_write" on mait_client_templates;
create policy "templates_write" on mait_client_templates for all
  using (workspace_id = mait_current_workspace() and mait_current_role() in ('super_admin','admin'))
  with check (workspace_id = mait_current_workspace() and mait_current_role() in ('super_admin','admin'));

grant all on mait_client_templates to anon, authenticated, service_role;
