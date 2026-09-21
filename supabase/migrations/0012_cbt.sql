-- Release 2, milestone 3: computer-based tests.
--
-- The security problem with a CBT is not the tenant boundary, it is the answer
-- key. A pupil has to read the options in order to answer, and RLS is
-- row-level, not column-level: an `is_correct` column on the options row would
-- be one `select *` away from being handed to the candidate.
--
-- So the key lives in its own table, cbt_answer_keys, with no student-readable
-- policy at all. Marking happens inside a security definer function that can
-- see the key even though the caller never can.

create type app.cbt_question_kind as enum ('single_choice', 'multi_choice', 'true_false');
create type app.cbt_attempt_status as enum ('in_progress', 'submitted', 'expired');

create table public.cbt_tests (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  term_id          uuid not null references public.terms(id) on delete cascade,
  class_level_id   uuid not null references public.class_levels(id) on delete cascade,
  subject_id       uuid not null references public.subjects(id) on delete cascade,
  -- When set, a submitted attempt writes its score straight into the mark book.
  assessment_id    uuid references public.assessments(id) on delete set null,
  title            text not null check (length(btrim(title)) between 2 and 120),
  instructions     text,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  opens_at         timestamptz not null,
  closes_at        timestamptz not null,
  shuffle          boolean not null default true,
  status           app.assessment_status not null default 'draft',
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index cbt_tests_school_idx on public.cbt_tests (school_id, term_id, class_level_id);

create table public.cbt_questions (
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  test_id   uuid not null references public.cbt_tests(id) on delete cascade,
  ordinal   integer not null check (ordinal > 0),
  prompt    text not null check (length(btrim(prompt)) between 1 and 2000),
  kind      app.cbt_question_kind not null default 'single_choice',
  marks     numeric(6,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, ordinal)
);
create index cbt_questions_test_idx on public.cbt_questions (test_id, ordinal);

-- Deliberately carries no correctness column.
create table public.cbt_options (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  question_id uuid not null references public.cbt_questions(id) on delete cascade,
  ordinal     integer not null check (ordinal > 0),
  label       text not null check (length(btrim(label)) between 1 and 500),
  created_at  timestamptz not null default now(),
  unique (question_id, ordinal)
);
create index cbt_options_question_idx on public.cbt_options (question_id, ordinal);

-- The key. No student-facing policy exists for this table, by design.
create table public.cbt_answer_keys (
  question_id uuid primary key references public.cbt_questions(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  option_ids  uuid[] not null check (cardinality(option_ids) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.cbt_attempts (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  test_id       uuid not null references public.cbt_tests(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  status        app.cbt_attempt_status not null default 'in_progress',
  started_at    timestamptz not null default now(),
  -- Fixed when the attempt starts, so a slow connection or a reload cannot buy
  -- extra minutes and the server is the only clock that counts.
  expires_at    timestamptz not null,
  submitted_at  timestamptz,
  score         numeric(6,2),
  max_score     numeric(6,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (test_id, enrollment_id)
);
create index cbt_attempts_school_idx on public.cbt_attempts (school_id, test_id);
create index cbt_attempts_enrollment_idx on public.cbt_attempts (enrollment_id);

create table public.cbt_answers (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  attempt_id    uuid not null references public.cbt_attempts(id) on delete cascade,
  question_id   uuid not null references public.cbt_questions(id) on delete cascade,
  option_ids    uuid[] not null default '{}',
  is_correct    boolean,
  marks_awarded numeric(6,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index cbt_answers_attempt_idx on public.cbt_answers (attempt_id);

do $$
declare t text;
begin
  foreach t in array array['cbt_tests','cbt_questions','cbt_answer_keys',
                           'cbt_attempts','cbt_answers'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s
                      for each row execute function app.touch_updated_at()', t);
  end loop;
  foreach t in array array['cbt_tests','cbt_attempts'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                      for each row execute function app.write_audit()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['cbt_tests','cbt_questions','cbt_options','cbt_answer_keys',
                           'cbt_attempts','cbt_answers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;

  -- Staff author and mark. One policy set for all six tables.
  foreach t in array array['cbt_tests','cbt_questions','cbt_options','cbt_answer_keys',
                           'cbt_attempts','cbt_answers'] loop
    execute format('create policy %1$s_staff_read on public.%1$s for select to authenticated
                      using (app.can_read(school_id))', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated
                      with check (app.can_teach(school_id))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated
                      using (app.can_teach(school_id)) with check (app.can_teach(school_id))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated
                      using (app.can_teach(school_id))', t);
  end loop;
end $$;

-- Is this test open to the caller right now?
create or replace function app.can_sit_test(target_test uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.cbt_tests t
    join public.enrollments e on e.term_id = t.term_id
    join public.class_arms arm on arm.id = e.class_arm_id
    where t.id = target_test
      and t.status = 'published'
      and arm.class_level_id = t.class_level_id
      and e.student_id = app.my_student_id(t.school_id)
      and e.status = 'active'
  );
$$;
grant execute on function app.can_sit_test(uuid) to authenticated;

-- A candidate sees a published test for their class level, its questions and
-- its options. They never see cbt_answer_keys: no policy grants it, and RLS
-- denies by default.
create policy cbt_tests_read_self on public.cbt_tests for select to authenticated
  using (status = 'published' and app.can_sit_test(id));

create policy cbt_questions_read_self on public.cbt_questions for select to authenticated
  using (app.can_sit_test(test_id));

create policy cbt_options_read_self on public.cbt_options for select to authenticated
  using (
    exists (select 1 from public.cbt_questions q
            where q.id = public.cbt_options.question_id and app.can_sit_test(q.test_id))
  );

-- Their own attempt and their own answers.
create policy cbt_attempts_read_self on public.cbt_attempts for select to authenticated
  using (app.owns_enrollment(enrollment_id));

create policy cbt_answers_read_self on public.cbt_answers for select to authenticated
  using (
    exists (select 1 from public.cbt_attempts a
            where a.id = public.cbt_answers.attempt_id and app.owns_enrollment(a.enrollment_id))
  );

-- ------------------------------------------------------------- sitting a test
-- Starting an attempt is a function rather than an insert, because the clock
-- has to be set server-side.
create or replace function public.start_cbt_attempt(p_test uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t record;
  enrol uuid;
  attempt public.cbt_attempts;
begin
  select * into t from public.cbt_tests where id = p_test;
  if t is null or t.status <> 'published' then
    raise exception 'test not available' using errcode = '42501';
  end if;
  if not app.can_sit_test(p_test) then
    raise exception 'you are not a candidate for this test' using errcode = '42501';
  end if;
  if now() < t.opens_at or now() > t.closes_at then
    raise exception 'this test is not open right now' using errcode = '22023';
  end if;

  select e.id into enrol
  from public.enrollments e
  join public.class_arms arm on arm.id = e.class_arm_id
  where e.term_id = t.term_id
    and arm.class_level_id = t.class_level_id
    and e.student_id = app.my_student_id(t.school_id);

  select * into attempt from public.cbt_attempts
   where test_id = p_test and enrollment_id = enrol;

  if attempt.id is not null then
    if attempt.status <> 'in_progress' then
      raise exception 'you have already submitted this test' using errcode = '22023';
    end if;
    return attempt.id;              -- resume, on the original clock
  end if;

  insert into public.cbt_attempts (school_id, test_id, enrollment_id, expires_at)
  values (t.school_id, p_test, enrol,
          least(now() + make_interval(mins => t.duration_minutes), t.closes_at))
  returning id into attempt.id;

  return attempt.id;
end;
$$;

-- Saving progress mid-test. No marking happens here, so nothing leaks.
create or replace function public.save_cbt_answers(p_attempt uuid, p_answers jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; saved integer;
begin
  select * into a from public.cbt_attempts where id = p_attempt;
  if a is null or not app.owns_enrollment(a.enrollment_id) then
    raise exception 'not your attempt' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'this attempt is closed' using errcode = '22023';
  end if;
  if now() > a.expires_at then
    update public.cbt_attempts set status = 'expired' where id = p_attempt;
    raise exception 'time is up' using errcode = '22023';
  end if;

  insert into public.cbt_answers (school_id, attempt_id, question_id, option_ids)
  select a.school_id, p_attempt, (e ->> 'question_id')::uuid,
         coalesce((select array_agg(value::text::uuid)
                   from jsonb_array_elements_text(e -> 'option_ids') as value), '{}')
  from jsonb_array_elements(p_answers) as e
  on conflict (attempt_id, question_id) do update set option_ids = excluded.option_ids;
  get diagnostics saved = row_count;
  return saved;
end;
$$;

-- Submitting marks the attempt against the key the candidate cannot read, and
-- pushes the result into the mark book when the test is linked to one.
create or replace function public.submit_cbt_attempt(p_attempt uuid, p_answers jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a record; t record; total numeric := 0; possible numeric := 0; late boolean;
begin
  select * into a from public.cbt_attempts where id = p_attempt;
  if a is null or not app.owns_enrollment(a.enrollment_id) then
    raise exception 'not your attempt' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'this attempt has already been submitted' using errcode = '22023';
  end if;

  late := now() > a.expires_at + interval '30 seconds';

  if jsonb_array_length(p_answers) > 0 and not late then
    perform public.save_cbt_answers(p_attempt, p_answers);
  end if;

  select * into t from public.cbt_tests where id = a.test_id;

  -- An unanswered question must score zero, not be skipped, so every question
  -- on the paper gets a row before marking runs.
  insert into public.cbt_answers (school_id, attempt_id, question_id, option_ids)
  select a.school_id, p_attempt, q.id, '{}'
  from public.cbt_questions q
  where q.test_id = a.test_id
  on conflict (attempt_id, question_id) do nothing;

  -- Correct means the selected set and the key are the same set, which handles
  -- multi-choice without special-casing it. The predicate is written out twice
  -- rather than hoisted into a LATERAL, because an UPDATE's FROM clause cannot
  -- reference its own target table (42P10).
  update public.cbt_answers ans
     set is_correct    = (k.option_ids is not null
                          and ans.option_ids @> k.option_ids
                          and k.option_ids @> ans.option_ids),
         marks_awarded = case when (k.option_ids is not null
                                    and ans.option_ids @> k.option_ids
                                    and k.option_ids @> ans.option_ids)
                              then q.marks else 0 end
  from public.cbt_questions q
  left join public.cbt_answer_keys k on k.question_id = q.id
  where ans.attempt_id = p_attempt and q.id = ans.question_id;

  select coalesce(sum(ans.marks_awarded), 0) into total
  from public.cbt_answers ans where ans.attempt_id = p_attempt;

  select coalesce(sum(q.marks), 0) into possible
  from public.cbt_questions q where q.test_id = a.test_id;

  update public.cbt_attempts
     set status = 'submitted', submitted_at = now(), score = total, max_score = possible
   where id = p_attempt;

  if t.assessment_id is not null and possible > 0 then
    insert into public.assessment_scores (school_id, assessment_id, enrollment_id, score, recorded_by)
    select t.school_id, t.assessment_id, a.enrollment_id,
           round(total / possible * ass.max_score, 2), auth.uid()
    from public.assessments ass where ass.id = t.assessment_id
    on conflict (assessment_id, enrollment_id)
      do update set score = excluded.score, recorded_by = excluded.recorded_by;
  end if;

  return jsonb_build_object('score', total, 'max_score', possible, 'late', late);
end;
$$;

grant execute on function public.start_cbt_attempt(uuid),
  public.save_cbt_answers(uuid, jsonb),
  public.submit_cbt_attempt(uuid, jsonb) to authenticated;
