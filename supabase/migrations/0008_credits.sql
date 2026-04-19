-- =====================================================================
-- 0008 — Credit system & subscription tiers
-- Adds subscription/billing columns to mait_users, plus credit history,
-- credit purchases, subscription plans, and helper functions.
-- =====================================================================

-- ---------- ENUMS ----------

do $$ begin
  create type mait_subscription_tier as enum ('scout','analyst','strategist','agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mait_subscription_status as enum ('active','canceled','past_due','trialing','paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mait_billing_interval as enum ('monthly','yearly');
exception when duplicate_object then null; end $$;

-- ---------- ALTER mait_users ----------

alter table mait_users
  add column if not exists credits_balance        integer default 10,
  add column if not exists subscription_tier      mait_subscription_tier default 'scout',
  add column if not exists subscription_status    mait_subscription_status,
  add column if not exists billing_interval       mait_billing_interval,
  add column if not exists monthly_credits        integer default 10,
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists current_period_start   timestamptz,
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end   boolean default false;

-- ---------- SUBSCRIPTION PLANS ----------

create table if not exists mait_subscription_plans (
  id                      uuid primary key default uuid_generate_v4(),
  tier                    mait_subscription_tier not null unique,
  name                    text not null,
  description             text,
  monthly_price           decimal(10,2) not null,
  yearly_price            decimal(10,2) not null,
  monthly_credits         integer not null,
  max_brands              integer not null,
  max_team_members        integer not null,
  features                jsonb not null default '[]'::jsonb,
  stripe_monthly_price_id text,
  stripe_yearly_price_id  text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Seed the 4 plans (idempotent via ON CONFLICT)
insert into mait_subscription_plans (tier, name, description, monthly_price, yearly_price, monthly_credits, max_brands, max_team_members, features)
values
  ('scout',      'Scout',      'Free tier for individuals getting started',          0,    0,    10,  2,  1,  '["Competitor monitoring","Basic AI analysis"]'::jsonb),
  ('analyst',    'Analyst',    'For marketers who need deeper insights',             29,   299,  80,  10, 1,  '["Everything in Scout","Advanced AI reports","Weekly digest"]'::jsonb),
  ('strategist', 'Strategist', 'For teams managing multiple brands',                 89,   899,  250, 25, 3,  '["Everything in Analyst","Team collaboration","Priority support"]'::jsonb),
  ('agency',     'Agency',     'For agencies managing large client portfolios',      239,  2399, 650, -1, 10, '["Everything in Strategist","Unlimited brands","Dedicated support","Custom integrations"]'::jsonb)
on conflict (tier) do update set
  name            = excluded.name,
  description     = excluded.description,
  monthly_price   = excluded.monthly_price,
  yearly_price    = excluded.yearly_price,
  monthly_credits = excluded.monthly_credits,
  max_brands      = excluded.max_brands,
  max_team_members = excluded.max_team_members,
  features        = excluded.features,
  updated_at      = now();

-- ---------- CREDITS HISTORY ----------

create table if not exists mait_credits_history (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references mait_users(id) on delete cascade,
  amount       integer not null,
  reason       text not null,
  reference_id uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_mait_credits_history_user on mait_credits_history(user_id);

-- ---------- CREDIT PURCHASES ----------

create table if not exists mait_credit_purchases (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null references mait_users(id) on delete cascade,
  credits                  integer not null,
  amount_paid              decimal(10,2) not null,
  currency                 text not null default 'usd',
  stripe_payment_intent_id text,
  stripe_session_id        text unique,
  status                   text not null default 'pending',
  created_at               timestamptz not null default now()
);
create index if not exists idx_mait_credit_purchases_user on mait_credit_purchases(user_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table mait_subscription_plans enable row level security;
alter table mait_credits_history    enable row level security;
alter table mait_credit_purchases   enable row level security;

-- subscription_plans: readable by everyone (public catalog)
drop policy if exists "plans_select" on mait_subscription_plans;
create policy "plans_select" on mait_subscription_plans for select
  using (true);

-- credits_history: users see their own rows
drop policy if exists "credits_history_select" on mait_credits_history;
create policy "credits_history_select" on mait_credits_history for select
  using (user_id = auth.uid());

-- credit_purchases: users see their own rows
drop policy if exists "credit_purchases_select" on mait_credit_purchases;
create policy "credit_purchases_select" on mait_credit_purchases for select
  using (user_id = auth.uid());

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- Consume credits atomically. Returns TRUE on success, FALSE if
-- the user's balance is insufficient.
create or replace function mait_consume_credits(
  p_user_id      uuid,
  p_amount       integer,
  p_reason       text,
  p_reference_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  -- Lock the row to prevent concurrent deductions
  select credits_balance into v_balance
    from mait_users
   where id = p_user_id
     for update;

  if v_balance is null or v_balance < p_amount then
    return false;
  end if;

  update mait_users
     set credits_balance = credits_balance - p_amount
   where id = p_user_id;

  insert into mait_credits_history (user_id, amount, reason, reference_id)
  values (p_user_id, -p_amount, p_reason, p_reference_id);

  return true;
end;
$$;

-- Add credits (top-up, subscription renewal, purchase, etc.)
create or replace function mait_add_credits(
  p_user_id uuid,
  p_amount  integer,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mait_users
     set credits_balance = credits_balance + p_amount
   where id = p_user_id;

  insert into mait_credits_history (user_id, amount, reason)
  values (p_user_id, p_amount, p_reason);
end;
$$;
