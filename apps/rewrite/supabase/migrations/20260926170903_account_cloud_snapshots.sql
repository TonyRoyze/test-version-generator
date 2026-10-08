-- A complete account is published atomically by moving one revision pointer.
-- The ZIP includes canonical records, working copies, history, and image bytes.
create table public.account_heads (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  object_path text not null,
  updated_at timestamptz not null default now(),
  constraint account_snapshot_owner_path check (
    object_path = owner_id::text || '/' || revision::text || '.zip'
  )
);
alter table public.account_heads enable row level security;
revoke all on public.account_heads from anon, authenticated;
grant select, insert, update on public.account_heads to authenticated;
create policy "Read own account head" on public.account_heads
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Create own account head" on public.account_heads
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own account head" on public.account_heads
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-snapshots', 'account-snapshots', false, 52428800, array['application/zip']);
-- Immutable object names: uploads cannot overwrite another device's revision.
create policy "Read own account snapshots" on storage.objects
  for select to authenticated
  using (bucket_id = 'account-snapshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own account snapshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'account-snapshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
