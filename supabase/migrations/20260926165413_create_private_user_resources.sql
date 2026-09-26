-- Cloud records for private Question Banks and Exams.
-- The application stores versioned domain records as JSONB so it can retain
-- the same import/export format without flattening rich question documents.
create table if not exists public.user_resources (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('question_bank', 'exam')),
  title text not null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create index if not exists user_resources_owner_updated_idx
  on public.user_resources (owner_id, updated_at desc);

alter table public.user_resources enable row level security;

revoke all on table public.user_resources from anon, authenticated;
grant select, insert, update, delete on table public.user_resources to authenticated;

create policy "Users can read their own resources"
  on public.user_resources for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own resources"
  on public.user_resources for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own resources"
  on public.user_resources for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own resources"
  on public.user_resources for delete to authenticated
  using ((select auth.uid()) = owner_id);
