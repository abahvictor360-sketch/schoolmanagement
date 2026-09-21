-- Role separation: anonymous callers see nothing at all, and a teacher can read
-- their school and take attendance but cannot edit records or read the audit log.

do $$
declare
  greenfield uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  gf_teacher uuid := '33333333-3333-4333-8333-333333333333';
  seen bigint; affected bigint; tbl text;
  failures text[] := '{}';
  arm uuid; term uuid;
begin
  select a.id into arm from public.class_arms a where a.school_id = greenfield limit 1;
  select t.id into term from public.terms t where t.school_id = greenfield and t.is_current;

  -- Deny by default: an unauthenticated caller reads nothing anywhere.
  set local role anon;
  foreach tbl in array array['schools','students','staff','enrollments','attendance_entries','audit_log'] loop
    execute format('select count(*) from public.%I', tbl) into seen;
    if seen <> 0 then failures := failures || format('anon read %s rows from %s', seen, tbl); end if;
  end loop;
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_teacher, 'role', 'authenticated',
                      'email', 'teacher@greenfield.test')::text, true);
  set local role authenticated;

  select count(*) into seen from public.students;
  if seen = 0 then failures := failures || 'teacher cannot read their own school students'; end if;

  begin
    insert into public.students (school_id, admission_number, first_name, last_name)
    values (greenfield, 'TEACHER/INJECT', 'No', 'Way');
    failures := failures || 'teacher could create a student';
  exception when insufficient_privilege or check_violation then null;
  end;

  update public.staff set full_name = 'Renamed' where school_id = greenfield;
  get diagnostics affected = row_count;
  if affected <> 0 then failures := failures || 'teacher could edit staff'; end if;

  select count(*) into seen from public.audit_log;
  if seen <> 0 then failures := failures || 'teacher could read the audit log'; end if;

  -- Attendance is a teacher's job, so this one must succeed.
  perform public.save_attendance(
    greenfield, arm, term, current_date,
    (select coalesce(jsonb_agg(jsonb_build_object('enrollment_id', e.id, 'status', 'present')), '[]'::jsonb)
     from public.enrollments e where e.class_arm_id = arm and e.term_id = term));

  select count(*) into seen from public.attendance_registers
  where class_arm_id = arm and register_date = current_date and taken_by = gf_teacher;
  if seen <> 1 then failures := failures || 'teacher could not save a register'; end if;

  reset role;

  if array_length(failures, 1) is null then
    raise notice 'role separation suite: all checks passed';
  else
    raise exception 'ROLE FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
