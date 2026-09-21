-- Results and CBT, from the candidate's side.
--
-- The check that matters most here is cbt_answer_keys. A pupil must be able to
-- read the questions and the options in order to sit the paper, and must never
-- be able to read which option is right. RLS is row-level, not column-level,
-- which is exactly why the key lives in its own table with no student policy.
--
-- Requires supabase/seed/demo.sql.

do $$
declare
  gf uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  pupil_uid uuid := '66666666-6666-4666-8666-666666666666';
  seen bigint; affected bigint; pupil uuid; my_enrol uuid; test uuid; attempt uuid;
  q1 uuid; q2 uuid; q3 uuid; verdict jsonb; res record; keys_seen bigint;
  failures text[] := '{}';
begin
  select id into pupil from public.students where profile_id = pupil_uid;
  select e.id into my_enrol from public.enrollments e
    join public.terms t on t.id = e.term_id and t.is_current
    where e.student_id = pupil;
  select id into test from public.cbt_tests where school_id = gf limit 1;
  if test is null then
    raise notice 'no CBT paper seeded; skipping the CBT half of this suite';
  end if;
  select id into q1 from public.cbt_questions where test_id = test and ordinal = 1;
  select id into q2 from public.cbt_questions where test_id = test and ordinal = 2;
  select id into q3 from public.cbt_questions where test_id = test and ordinal = 3;

  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil_uid, 'role', 'authenticated',
                      'email', 'student@greenfield.test')::text, true);
  set local role authenticated;

  -- Own marks only, and only from published assessments.
  select count(*) into seen from public.assessment_scores
   where enrollment_id <> my_enrol;
  if seen <> 0 then failures := failures || format('pupil sees %s classmates'' marks', seen); end if;

  -- The result sheet grades against this school's own bands.
  select * into res from public.result_sheet(my_enrol) limit 1;
  if res.grade_label is null then failures := failures || 'result_sheet produced no grade'; end if;
  if coalesce(res.percentage, 0) <= 0 then failures := failures || 'result_sheet produced no percentage'; end if;

  if test is not null then
    -- THE check: the answer key is invisible.
    select count(*) into keys_seen from public.cbt_answer_keys;
    if keys_seen <> 0 then
      failures := failures || format('CANDIDATE READ %s ANSWER KEYS', keys_seen);
    end if;

    -- The paper itself is readable.
    select count(*) into seen from public.cbt_questions where test_id = test;
    if seen = 0 then failures := failures || 'candidate cannot read the questions'; end if;
    select count(*) into seen from public.cbt_options;
    if seen = 0 then failures := failures || 'candidate cannot read the options'; end if;

    -- The paper is not writable.
    begin
      insert into public.cbt_answer_keys (question_id, school_id, option_ids)
      values (q1, gf, array[q1]);
      failures := failures || 'candidate wrote an answer key';
    exception when others then null; end;

    update public.cbt_questions set marks = 99 where id = q1;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'candidate edited a question'; end if;
  end if;

  reset role;

  if array_length(failures, 1) is null then
    raise notice 'student academics suite: all checks passed';
  else
    raise exception 'STUDENT ACADEMICS FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
