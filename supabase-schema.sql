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
