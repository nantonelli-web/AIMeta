-- Admin backend: mait_admins table (separate from mait_users)
create table if not exists mait_admins (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  password_hash text not null,
  name text,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  created_at timestamptz not null default now()
);

-- Enable RLS (no policies — admin client uses service role to bypass)
alter table mait_admins enable row level security;
