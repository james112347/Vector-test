-- =============================================================
-- Vector App - Supabase Schema
-- Esegui questo SQL nella console SQL del tuo progetto Supabase
-- (Dashboard → SQL Editor → New Query)
-- =============================================================

-- Tabella utenti sincronizzata con l'app
create table if not exists public.app_users (
  id bigint generated always as identity primary key,
  email text unique not null,
  is_approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indice per query utenti in attesa
create index if not exists idx_app_users_pending
  on public.app_users (is_approved) where not is_approved;

-- Abilita Row Level Security
alter table public.app_users enable row level security;

-- Policy: chiunque puo registrarsi (insert)
create policy "allow_insert" on public.app_users
  for insert with check (true);

-- Policy: chiunque puo leggere (per ora - admin check lato client)
create policy "allow_select" on public.app_users
  for select using (true);

-- Policy: chiunque puo aggiornare (per ora - admin check lato client)
create policy "allow_update" on public.app_users
  for update using (true);

-- Policy: chiunque puo eliminare (per ora - admin check lato client)
create policy "allow_delete" on public.app_users
  for delete using (true);

-- Abilita Realtime per questa tabella
alter publication supabase_realtime add table public.app_users;

-- =============================================================
-- Sahha Health Data Tables
-- =============================================================

-- Profili Sahha collegati agli utenti dell'app
create table if not exists public.sahha_profiles (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.app_users(id) on delete cascade,
  external_id text unique not null,  -- UUID usato come externalId in Sahha
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sahha_profiles_user
  on public.sahha_profiles (user_id);

alter table public.sahha_profiles enable row level security;
create policy "sahha_profiles_all" on public.sahha_profiles
  for all using (true) with check (true);

-- Score di salute calcolati da Sahha (wellbeing, activity, sleep, readiness, mental_wellbeing)
create table if not exists public.sahha_scores (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.app_users(id) on delete cascade,
  type text not null,              -- wellbeing | activity | sleep | readiness | mental_wellbeing
  score numeric(4,3) not null,     -- 0.000 - 1.000
  state text not null,             -- high | medium | low | minimal
  factors jsonb,                   -- array di {name, value, goal, score, state}
  score_date_time timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sahha_scores_user_type
  on public.sahha_scores (user_id, type, score_date_time desc);

alter table public.sahha_scores enable row level security;
create policy "sahha_scores_all" on public.sahha_scores
  for all using (true) with check (true);

-- Biomarker grezzi da Sahha (passi, frequenza cardiaca, sonno, ecc.)
create table if not exists public.sahha_biomarkers (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.app_users(id) on delete cascade,
  sahha_id text unique,            -- ID univoco dal webhook Sahha (per idempotenza)
  type text not null,              -- steps, heart_rate_resting, sleep_duration, etc.
  category text not null,          -- activity | sleep | vitals | body
  value text not null,
  unit text,
  aggregation text,                -- total | average | minimum | maximum
  periodicity text,                -- daily | hourly
  start_date_time timestamptz not null,
  end_date_time timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sahha_biomarkers_user_type
  on public.sahha_biomarkers (user_id, type, start_date_time desc);

create index if not exists idx_sahha_biomarkers_user_category
  on public.sahha_biomarkers (user_id, category, start_date_time desc);

alter table public.sahha_biomarkers enable row level security;
create policy "sahha_biomarkers_all" on public.sahha_biomarkers
  for all using (true) with check (true);
