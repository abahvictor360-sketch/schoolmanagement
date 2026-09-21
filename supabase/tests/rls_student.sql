-- A pupil holds a membership, so every predicate of the form "is a member of
-- this school" now matches them. This suite exists to prove that granting a
-- student a login did not turn the school's records inside out.
--
-- Requires supabase/seed/demo.sql, which binds student@greenfield.test to the
-- first Greenfield pupil.

do $$
declare
  greenfield uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  brightstar uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  pupil      uuid := '66666666-6666-4666-8666-666666666666';
  seen bigint; affected bigint; own uuid; classmate uuid; my_enrol uuid;
  failures text[] := '{}';
begin
  select id into own from public.students where profile_id = pupil;
  select id into classmate from public.students
    where school_id = greenfield and profile_id is null limit 1;
  select e.id into my_enrol from public.enrollments e where e.student_id = own limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil, 'role', 'authenticated',
                      'email', 'student@greenfield.test')::text, true);
  set local role authenticated;

  -- Exactly one pupil is visible, and it is the caller.
  select count(*) into seen from public.students;
  if seen <> 1 then failures := failures || format('pupil sees %s student rows, expected 1', seen); end if;
  select count(*) into seen from public.students where id = own;
  if seen <> 1 then failures := failures || 'pupil cannot see their own record'; end if;
  select count(*) into seen from public.students where id = classmate;
  if seen <> 0 then failures := failures || 'pupil can read a classmate record'; end if;

  -- Own enrollment and own attendance, nothing else.
  select count(*) into seen from public.enrollments where id <> my_enrol;
  if seen <> 0 then failures := failures || format('pupil sees %s foreign enrollments', seen); end if;
  select count(*) into seen from public.attendance_entries where enrollment_id <> my_enrol;
  if seen <> 0 then failures := failures || format('pupil sees %s foreign attendance marks', seen); end if;
  select count(*) into seen from public.attendance_entries where enrollment_id = my_enrol;
  if seen = 0 then failures := failures || 'pupil cannot see their own attendance'; end if;

  -- Staff-only tables stay closed.
  select count(*) into seen from public.staff;
  if seen <> 0 then failures := failures || format('pupil read %s staff rows', seen); end if;
  select count(*) into seen from public.guardians;
  if seen <> 0 then failures := failures || format('pupil read %s guardian rows', seen); end if;
  select count(*) into seen from public.student_guardians;
  if seen <> 0 then failures := failures || 'pupil read student_guardians'; end if;
  select count(*) into seen from public.audit_log;
  if seen <> 0 then failures := failures || 'pupil read the audit log'; end if;

  -- Reference data a portal cannot render without.
  select count(*) into seen from public.schools;
  if seen <> 1 then failures := failures || format('pupil sees %s schools, expected 1', seen); end if;
  select count(*) into seen from public.terms;
  if seen = 0 then failures := failures || 'pupil cannot read the term calendar'; end if;
  select count(*) into seen from public.school_settings;
  if seen <> 1 then failures := failures || 'pupil cannot read their school settings'; end if;
  select count(*) into seen from public.class_arms;
  if seen = 0 then failures := failures || 'pupil cannot read class arms'; end if;

  -- The portal is read-only. A pupil may not rewrite their own history.
  begin
    update public.students set last_name = 'Changed' where id = own;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'pupil edited their own record'; end if;
  exception when insufficient_privilege or check_violation then null; end;

  begin
    insert into public.students (school_id, admission_number, first_name, last_name)
    values (greenfield, 'PUPIL/INJECT', 'No', 'Way');
    failures := failures || 'pupil created a student';
  exception when insufficient_privilege or check_violation then null; end;

  begin
    update public.attendance_entries set status = 'present' where enrollment_id = my_enrol;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'pupil rewrote their own attendance'; end if;
  exception when insufficient_privilege or check_violation then null; end;

  begin
    update public.enrollments set class_arm_id = class_arm_id where id = my_enrol;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'pupil edited their enrollment'; end if;
  exception when insufficient_privilege or check_violation then null; end;

  -- And still nothing from the other school.
  select count(*) into seen from public.students where school_id = brightstar;
  if seen <> 0 then failures := failures || 'pupil crossed tenants'; end if;

  reset role;

  if array_length(failures, 1) is null then
    raise notice 'student isolation suite: all checks passed';
  else
    raise exception 'STUDENT FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
