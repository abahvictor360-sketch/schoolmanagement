-- Milestone 5: attendance registers, taken against enrollments.

create type app.attendance_status as enum ('present','absent','late','excused');

create table public.attendance_registers (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  class_arm_id  uuid not null references public.class_arms(id) on delete cascade,
  term_id       uuid not null references public.terms(id) on delete cascade,
  register_date date not null,
  taken_by      uuid references auth.users(id) on delete set null,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_arm_id, register_date)
);
create index attendance_registers_idx on public.attendance_registers (school_id, term_id, register_date desc);

create table public.attendance_entries (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  register_id   uuid not null references public.attendance_registers(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  status        app.attendance_status not null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (register_id, enrollment_id)
);
create index attendance_entries_enrollment_idx on public.attendance_entries (school_id, enrollment_id);

-- Teachers may take and amend attendance; admins may too.
create or replace function app.can_take_attendance(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(target_school, 'school_admin', 'teacher') or app.is_platform_admin();
$$;
grant execute on function app.can_take_attendance(uuid) to authenticated;

alter table public.attendance_registers enable row level security;
alter table public.attendance_entries   enable row level security;
alter table public.attendance_registers force row level security;
alter table public.attendance_entries   force row level security;
create trigger touch_attendance_registers before update on public.attendance_registers for each row execute function app.touch_updated_at();
create trigger touch_attendance_entries before update on public.attendance_entries for each row execute function app.touch_updated_at();

create policy attendance_registers_read on public.attendance_registers for select to authenticated
  using (app.can_read(school_id));
create policy attendance_registers_write on public.attendance_registers for all to authenticated
  using (app.can_take_attendance(school_id)) with check (app.can_take_attendance(school_id));
create policy attendance_entries_read on public.attendance_entries for select to authenticated
  using (app.can_read(school_id));
create policy attendance_entries_write on public.attendance_entries for all to authenticated
  using (app.can_take_attendance(school_id)) with check (app.can_take_attendance(school_id));
