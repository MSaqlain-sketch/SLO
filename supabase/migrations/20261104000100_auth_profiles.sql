-- Phase 1 authentication only. Apply to an approved local/staging project first.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin'))
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
revoke all on public.profiles, public.user_roles from public, anon, authenticated;
grant select on public.profiles, public.user_roles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant all on public.profiles, public.user_roles to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy roles_read_own on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);
-- No client insert/update/delete policies or grants on user_roles.

create function public.babul_create_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  -- Ignore all user-supplied role/admin metadata.
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;
revoke all on function public.babul_create_auth_profile() from public, anon, authenticated;
create trigger babul_auth_user_created after insert on auth.users
  for each row execute function public.babul_create_auth_profile();

-- Preserve existing users; backfill profiles with no elevation of privileges.
insert into public.profiles (id, display_name)
  select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80) from auth.users
  on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
  select id, 'student' from auth.users on conflict (user_id) do nothing;

commit;
