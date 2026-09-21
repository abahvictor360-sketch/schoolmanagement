-- Milestone 4: the enrollment spine. Everything downstream hangs off this row,
-- never off students directly.

create type app.enrollment_status as enum ('active','promoted','repeated','withdrawn','transferred_out','graduated');

create table public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  class_arm_id uuid not null references public.class_arms(id) on delete restrict,
  term_id      uuid not null references public.terms(id) on delete restrict,
  status       app.enrollment_status not null default 'active',
  enrolled_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (student_id, term_id)
);
create index enrollments_roster_idx on public.enrollments (school_id, term_id, class_arm_id);
create index enrollments_student_idx on public.enrollments (school_id, student_id, term_id);

-- A student's enrollment, class arm and term must all belong to one school.
create or replace function app.enrollment_consistency()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.students s where s.id = new.student_id and s.school_id = new.school_id)
     or not exists (select 1 from public.class_arms c where c.id = new.class_arm_id and c.school_id = new.school_id)
     or not exists (select 1 from public.terms t where t.id = new.term_id and t.school_id = new.school_id) then
    raise exception 'enrollment references rows from another school';
  end if;
  return new;
end;
$$;
create trigger enrollments_consistency before insert or update on public.enrollments
  for each row execute function app.enrollment_consistency();

alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
create trigger touch_enrollments before update on public.enrollments for each row execute function app.touch_updated_at();

create policy enrollments_read on public.enrollments for select to authenticated
  using (app.can_read(school_id));
create policy enrollments_write on public.enrollments for all to authenticated
  using (app.can_admin(school_id)) with check (app.can_admin(school_id));
