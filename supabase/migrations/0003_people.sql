-- Milestone 3: staff, students, guardians.

create type app.student_status as enum ('active','graduated','withdrawn','transferred');
create type app.employment_status as enum ('active','on_leave','resigned','terminated');
create type app.sex as enum ('male','female');

create table public.staff (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  profile_id        uuid references public.profiles(id) on delete set null,
  staff_number      text not null check (length(btrim(staff_number)) between 1 and 40),
  full_name         text not null check (length(btrim(full_name)) between 2 and 160),
  email             citext,
  phone             text,
  designation       text,
  employment_status app.employment_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, staff_number)
);
create index staff_school_name_idx on public.staff (school_id, full_name);
create index staff_profile_idx on public.staff (profile_id) where profile_id is not null;

alter table public.class_arms
  add column form_teacher_id uuid references public.staff(id) on delete set null;

create table public.class_subjects (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  subject_id          uuid not null references public.subjects(id) on delete cascade,
  class_level_id      uuid not null references public.class_levels(id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  teacher_id          uuid references public.staff(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (academic_session_id, class_level_id, subject_id)
);
create index class_subjects_school_idx on public.class_subjects (school_id, academic_session_id);
create index class_subjects_teacher_idx on public.class_subjects (teacher_id) where teacher_id is not null;

create table public.students (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  admission_number text not null check (length(btrim(admission_number)) between 1 and 40),
  first_name       text not null check (length(btrim(first_name)) between 1 and 80),
  last_name        text not null check (length(btrim(last_name)) between 1 and 80),
  middle_name      text,
  date_of_birth    date,
  sex              app.sex,
  photo_path       text,
  admitted_on      date not null default current_date,
  status           app.student_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, admission_number)
);
create index students_school_status_idx on public.students (school_id, status, last_name, first_name);
create index students_search_idx on public.students using gin (
  (school_id::text || ' ' || first_name || ' ' || last_name || ' ' || admission_number) gin_trgm_ops
);

create table public.guardians (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) between 2 and 160),
  phone      text,
  email      citext,
  occupation text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_school_name_idx on public.guardians (school_id, full_name);

create table public.student_guardians (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  guardian_id  uuid not null references public.guardians(id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (student_id, guardian_id)
);
create unique index student_guardians_one_primary on public.student_guardians (student_id) where is_primary;
create index student_guardians_guardian_idx on public.student_guardians (school_id, guardian_id);

alter table public.staff             enable row level security;
alter table public.class_subjects    enable row level security;
alter table public.students          enable row level security;
alter table public.guardians         enable row level security;
alter table public.student_guardians enable row level security;
alter table public.staff             force row level security;
alter table public.class_subjects    force row level security;
alter table public.students          force row level security;
alter table public.guardians         force row level security;
alter table public.student_guardians force row level security;

do $$
declare t text;
begin
  foreach t in array array['staff','class_subjects','students','guardians','student_guardians'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.can_read(school_id))', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (app.can_admin(school_id)) with check (app.can_admin(school_id))', t);
  end loop;
  foreach t in array array['staff','class_subjects','students','guardians'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;
