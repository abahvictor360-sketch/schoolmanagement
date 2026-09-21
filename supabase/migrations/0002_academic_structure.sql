-- Milestone 2: academic calendar and class structure. All rules are data.

create table public.academic_sessions (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  label      text not null check (length(btrim(label)) between 2 and 40),
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, label),
  check (ends_on > starts_on)
);
create unique index academic_sessions_one_current on public.academic_sessions (school_id) where is_current;

create table public.terms (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  ordinal             smallint not null check (ordinal between 1 and 12),
  label               text not null,
  starts_on           date not null,
  ends_on             date not null,
  is_current          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (academic_session_id, ordinal),
  check (ends_on > starts_on)
);
create unique index terms_one_current on public.terms (school_id) where is_current;
create index terms_school_idx on public.terms (school_id, academic_session_id, ordinal);

create table public.class_levels (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  label      text not null check (length(btrim(label)) between 1 and 60),
  ordinal    smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, label),
  unique (school_id, ordinal)
);

create table public.class_arms (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  class_level_id uuid not null references public.class_levels(id) on delete cascade,
  label          text not null check (length(btrim(label)) between 1 and 30),
  capacity       smallint check (capacity > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (class_level_id, label)
);
create index class_arms_school_idx on public.class_arms (school_id, class_level_id);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 80),
  code       text not null check (length(btrim(code)) between 2 and 16),
  is_core    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

alter table public.academic_sessions enable row level security;
alter table public.terms             enable row level security;
alter table public.class_levels      enable row level security;
alter table public.class_arms        enable row level security;
alter table public.subjects          enable row level security;
alter table public.academic_sessions force row level security;
alter table public.terms             force row level security;
alter table public.class_levels      force row level security;
alter table public.class_arms        force row level security;
alter table public.subjects          force row level security;

do $$
declare t text;
begin
  foreach t in array array['academic_sessions','terms','class_levels','class_arms','subjects'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.can_read(school_id))', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (app.can_admin(school_id)) with check (app.can_admin(school_id))', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;
