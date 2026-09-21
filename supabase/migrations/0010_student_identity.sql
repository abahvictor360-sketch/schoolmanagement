-- Release 2, milestone 1: a student can hold a login.
--
-- The dangerous part of this change is not the new table column, it is that
-- `student` becomes a real membership role. Every read policy written so far is
-- built on app.can_read(), which was "any active member of this school". The
-- moment a pupil holds a membership, that predicate would hand them the whole
-- school: every other pupil's date of birth, every guardian's phone number,
-- every staff record.
--
-- So can_read() is narrowed here to mean staff-level read, reference data gets
-- its own predicate that members of any role may use, and students get explicit
-- policies covering exactly their own rows and nothing else.

-- ------------------------------------------------------- link a login to a pupil
alter table public.students
  add column profile_id uuid references public.profiles(id) on delete set null;

create unique index students_profile_idx
  on public.students (profile_id) where profile_id is not null;

-- An invitation for a student has to say which pupil it is for.
alter table public.school_invitations
  add column student_id uuid references public.students(id) on delete cascade;

create index school_invitations_student_idx
  on public.school_invitations (student_id) where student_id is not null;

alter table public.school_invitations
  add constraint school_invitations_student_role_ck
  check ((role = 'student') = (student_id is not null));

-- --------------------------------------------------------------- helpers
-- Staff-level read. This REPLACES the old "any member" meaning, which is what
-- keeps the existing policies safe now that pupils are members too.
create or replace function app.can_read(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(target_school, 'school_admin', 'teacher', 'bursar')
      or app.is_platform_admin();
$$;

-- Reference data — the school itself, its calendar, its class structure and its
-- subject list. Not sensitive, and a pupil cannot render their own timetable
-- without it.
create or replace function app.can_read_reference(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_member(target_school) or app.is_platform_admin();
$$;

-- The pupil row belonging to the caller in this school, if any.
create or replace function app.my_student_id(target_school uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select s.id from public.students s
  where s.school_id = target_school
    and s.profile_id = (select auth.uid())
    and s.status = 'active'
  limit 1;
$$;

-- Does this enrollment belong to the caller? Used by every student-facing
-- policy downstream, so attendance, results and CBT all narrow the same way.
create or replace function app.owns_enrollment(target_enrollment uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where e.id = target_enrollment
      and s.profile_id = (select auth.uid())
  );
$$;

grant execute on function app.can_read_reference(uuid), app.my_student_id(uuid),
  app.owns_enrollment(uuid) to authenticated;

-- ------------------------------------------- reference tables open to members
do $$
declare t text;
begin
  foreach t in array array['school_settings','academic_sessions','terms',
                           'class_levels','class_arms','subjects'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated
                      using (app.can_read_reference(school_id))', t);
  end loop;
end $$;

drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools for select to authenticated
  using (app.can_read_reference(id));

-- ------------------------------------------------------ what a student may see
-- Their own record, and nothing about any other pupil.
create policy students_read_self on public.students for select to authenticated
  using (profile_id = (select auth.uid()));

-- Their own enrollment history: which arm, which term, which status.
create policy enrollments_read_self on public.enrollments for select to authenticated
  using (student_id = app.my_student_id(school_id));

-- Their own attendance marks, and the registers those marks sit in, so the
-- portal can show a date against each one.
create policy attendance_entries_read_self on public.attendance_entries for select to authenticated
  using (app.owns_enrollment(enrollment_id));

create policy attendance_registers_read_self on public.attendance_registers for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.class_arm_id = public.attendance_registers.class_arm_id
        and e.term_id = public.attendance_registers.term_id
        and e.student_id = app.my_student_id(public.attendance_registers.school_id)
    )
  );

-- The subjects offered to their class level, so the portal can list them.
create policy class_subjects_read_self on public.class_subjects for select to authenticated
  using (
    exists (
      select 1
      from public.enrollments e
      join public.class_arms a on a.id = e.class_arm_id
      where e.student_id = app.my_student_id(public.class_subjects.school_id)
        and a.class_level_id = public.class_subjects.class_level_id
    )
  );

-- ------------------------------------- redeeming a student invitation binds it
-- Extends the existing trigger: a student invitation also attaches the new
-- login to its pupil record. Still no service_role anywhere in the path.
create or replace function app.redeem_invitations()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.memberships (user_id, school_id, role, status)
  select new.id, i.school_id, i.role, 'active'
  from public.school_invitations i
  where i.email = new.email and i.accepted_at is null
  on conflict (user_id, school_id) do nothing;

  update public.students s
     set profile_id = new.id
    from public.school_invitations i
   where i.email = new.email
     and i.accepted_at is null
     and i.role = 'student'
     and s.id = i.student_id
     and s.profile_id is null;

  update public.school_invitations set accepted_at = now()
  where email = new.email and accepted_at is null;

  return new;
end;
$$;

-- Storage: a pupil may fetch their own passport photo, nobody else's.
create policy "student photos read own" on storage.objects for select to authenticated
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.students s
      where s.profile_id = (select auth.uid())
        and name = s.school_id::text || '/' || s.id::text || '.jpg'
    )
  );
