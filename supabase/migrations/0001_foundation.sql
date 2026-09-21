-- Milestone 1: platform foundation, identity, RLS helpers, audit log.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------- enums
create type app.user_role as enum (
  'platform_admin', 'school_admin', 'teacher', 'bursar', 'student', 'guardian'
);
create type app.membership_status as enum ('active', 'invited', 'suspended');
create type app.school_status as enum ('pending', 'active', 'suspended');

-- ---------------------------------------------------------------- schools
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 160),
  slug        citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  logo_url    text,
  address     text,
  phone       text,
  email       citext,
  status      app.school_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Academic rules are data, never code. One row per school.
create table public.school_settings (
  school_id       uuid primary key references public.schools(id) on delete cascade,
  preset_key      text not null default 'NG',
  academic_config jsonb not null,
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- identity
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null default '',
  phone             text,
  photo_url         text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  role       app.user_role not null,
  status     app.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, school_id)
);
create index memberships_school_idx on public.memberships (school_id, role) where status = 'active';
create index memberships_user_idx on public.memberships (user_id) where status = 'active';

create table public.audit_log (
  id         bigserial primary key,
  school_id  uuid references public.schools(id) on delete set null,
  actor_id   uuid references auth.users(id) on delete set null,
  entity     text not null,
  entity_id  text,
  action     text not null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_school_idx on public.audit_log (school_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (school_id, entity, entity_id);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies can read memberships without recursing into RLS.
create or replace function app.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function app.is_member(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_school is not null and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.school_id = target_school and m.status = 'active'
  );
$$;

create or replace function app.has_role(target_school uuid, variadic allowed app.user_role[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_school is not null and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.school_id = target_school
      and m.status = 'active' and m.role = any(allowed)
  );
$$;

-- Read access: any active member of the school, or a platform admin.
create or replace function app.can_read(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_member(target_school) or app.is_platform_admin();
$$;

-- Write access: school admins, or a platform admin.
create or replace function app.can_admin(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(target_school, 'school_admin') or app.is_platform_admin();
$$;

grant execute on function app.is_platform_admin(), app.is_member(uuid),
  app.has_role(uuid, app.user_role[]), app.can_read(uuid), app.can_admin(uuid)
  to authenticated;

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Custom access token hook. Stamps memberships into the JWT so the client can
-- render role-aware UI without a round trip. RLS never trusts these claims;
-- it re-reads memberships server-side.
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  claims jsonb;
  uid uuid := (event->>'user_id')::uuid;
  memberships_json jsonb;
  platform boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object('school_id', m.school_id, 'slug', s.slug, 'role', m.role)), '[]'::jsonb)
    into memberships_json
  from public.memberships m
  join public.schools s on s.id = m.school_id
  where m.user_id = uid and m.status = 'active' and s.status = 'active';

  select coalesce(p.is_platform_admin, false) into platform from public.profiles p where p.id = uid;

  claims := coalesce(event->'claims', '{}'::jsonb)
    || jsonb_build_object('memberships', memberships_json,
                          'is_platform_admin', coalesce(platform, false));
  return jsonb_set(event, '{claims}', claims);
end;
$$;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant all on table public.memberships, public.profiles, public.schools to supabase_auth_admin;

-- Every new auth user gets a profile row.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

create trigger touch_schools before update on public.schools for each row execute function app.touch_updated_at();
create trigger touch_school_settings before update on public.school_settings for each row execute function app.touch_updated_at();
create trigger touch_profiles before update on public.profiles for each row execute function app.touch_updated_at();
create trigger touch_memberships before update on public.memberships for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.schools         enable row level security;
alter table public.school_settings enable row level security;
alter table public.profiles        enable row level security;
alter table public.memberships     enable row level security;
alter table public.audit_log       enable row level security;

alter table public.schools         force row level security;
alter table public.school_settings force row level security;
alter table public.memberships     force row level security;
alter table public.audit_log       force row level security;

create policy schools_read on public.schools for select to authenticated
  using (app.can_read(id));
create policy schools_platform_write on public.schools for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy schools_admin_update on public.schools for update to authenticated
  using (app.has_role(id, 'school_admin')) with check (app.has_role(id, 'school_admin'));

create policy school_settings_read on public.school_settings for select to authenticated
  using (app.can_read(school_id));
create policy school_settings_write on public.school_settings for all to authenticated
  using (app.can_admin(school_id)) with check (app.can_admin(school_id));

-- A user always sees their own profile; school staff see profiles of people
-- they share an active school with.
create policy profiles_self on public.profiles for select to authenticated
  using (id = auth.uid()
     or app.is_platform_admin()
     or exists (
          select 1 from public.memberships mine
          join public.memberships theirs on theirs.school_id = mine.school_id
          where mine.user_id = auth.uid() and mine.status = 'active'
            and theirs.user_id = public.profiles.id and theirs.status = 'active'));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.can_read(school_id));
create policy memberships_write on public.memberships for all to authenticated
  using (app.can_admin(school_id)) with check (app.can_admin(school_id));

create policy audit_log_read on public.audit_log for select to authenticated
  using (app.can_admin(school_id));
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (app.is_member(school_id) or app.is_platform_admin());
