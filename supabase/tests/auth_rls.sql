-- Run only against an approved local/staging database after the Phase 1 migration.
-- All fixture writes are rolled back. No pgTAP dependency.
begin;
insert into auth.users (id, email, raw_user_meta_data)
values
 ('a1000000-0000-4000-8000-000000000001', 'babul-rls-a@example.test', '{"display_name":"A","role":"admin","is_admin":true}'),
 ('a1000000-0000-4000-8000-000000000002', 'babul-rls-b@example.test', '{"display_name":"B"}');

do $$ begin
  if (select role from public.user_roles where user_id = 'a1000000-0000-4000-8000-000000000001') <> 'student' then
    raise exception 'FAIL: signup metadata elevated user role';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
do $$ declare affected integer; begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: cross-user profile read'; end if;
  if (select count(*) from public.user_roles) <> 1 then raise exception 'FAIL: cross-user role read'; end if;
  update public.profiles set display_name = 'Updated' where id = 'a1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own profile update blocked'; end if;
  update public.profiles set display_name = 'Intrusion' where id = 'a1000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: cross-user profile update'; end if;
  begin
    update public.profiles set id = 'a1000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: user changed profile identity';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_roles set role = 'admin';
    raise exception 'FAIL: self-assigned admin role';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_roles (user_id, role) values ('a1000000-0000-4000-8000-000000000001', 'admin');
    raise exception 'FAIL: client inserted role';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profiles;
    raise exception 'FAIL: client deleted profile';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select display_name from public.profiles) <> 'B' then raise exception 'FAIL: second user isolation'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'FAIL: anonymous profile access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
