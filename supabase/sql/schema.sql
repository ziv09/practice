-- Practice PWA schema & RLS for Supabase

create table if not exists public.practice_state_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.practice_state_snapshots enable row level security;

create policy if not exists "snapshots_read_own" on public.practice_state_snapshots
  for select using (auth.uid() = user_id);
create policy if not exists "snapshots_insert_own" on public.practice_state_snapshots
  for insert with check (auth.uid() = user_id);
create policy if not exists "snapshots_update_own" on public.practice_state_snapshots
  for update using (auth.uid() = user_id);

create table if not exists public.user_push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.user_push_subscriptions enable row level security;

create policy if not exists "push_read_own" on public.user_push_subscriptions
  for select using (auth.uid() = user_id);
create policy if not exists "push_upsert_own" on public.user_push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy if not exists "push_update_own" on public.user_push_subscriptions
  for update using (auth.uid() = user_id);

