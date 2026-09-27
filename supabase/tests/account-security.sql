-- Transactional live/local integration test; leaves no users or data behind.
begin;
insert into auth.users (id) values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.account_heads(owner_id, revision, object_path) values
 ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.zip'),
 ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000004.zip');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
do $$
declare affected integer;
begin
  if (select count(*) from public.account_heads) <> 1 then raise exception 'Account isolation failed'; end if;
  update public.account_heads set updated_at = now() where owner_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update allowed'; end if;
  update public.account_heads set revision = 'aaaaaaaa-0000-4000-8000-000000000005', object_path = 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000005.zip'
    where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001' and revision = 'aaaaaaaa-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner update denied'; end if;
  update public.account_heads set updated_at = now() where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001' and revision = 'aaaaaaaa-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale revision overwrote new revision'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('account-snapshots', 'bbbbbbbb-0000-4000-8000-000000000002/forbidden.zip');
    raise exception 'Cross-account upload allowed';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects(bucket_id, name) values ('account-snapshots', 'aaaaaaaa-0000-4000-8000-000000000001/allowed.zip');
  if (select count(*) from storage.objects where bucket_id = 'account-snapshots') <> 1 then raise exception 'Storage isolation failed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.account_heads;
    raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'Account RLS, storage ownership, and stale-revision checks passed' as result;
