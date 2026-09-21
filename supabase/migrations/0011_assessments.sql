-- Release 2, milestone 2: assessments, marks and results.
--
-- Nothing here hardcodes a component, a weighting or a grade letter. An
-- assessment names a component_key, and that key is looked up in the school's
-- own academic_config to find its weight. A Nigerian school's 20/20/60 and a
-- Ghanaian school's 30/70 run through exactly the same code.

create type app.assessment_status as enum ('draft', 'published');

create table public.assessments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  term_id        uuid not null references public.terms(id) on delete cascade,
  class_level_id uuid not null references public.class_levels(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  -- Matches a key in school_settings.academic_config -> assessment_components.
  component_key  text not null check (length(btrim(component_key)) between 1 and 24),
  title          text not null check (length(btrim(title)) between 2 and 120),
  max_score      numeric(6,2) not null check (max_score > 0),
  held_on        date,
  status         app.assessment_status not null default 'draft',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (term_id, class_level_id, subject_id, component_key)
);
create index assessments_school_idx on public.assessments (school_id, term_id, class_level_id);
create index assessments_subject_idx on public.assessments (school_id, subject_id);

create table public.assessment_scores (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  -- Scored against the enrollment, never the student: a repeated year is a
  -- different enrollment and therefore a different set of marks.
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  score         numeric(6,2) not null check (score >= 0),
  recorded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assessment_id, enrollment_id)
);
create index assessment_scores_enrollment_idx on public.assessment_scores (school_id, enrollment_id);
create index assessment_scores_assessment_idx on public.assessment_scores (assessment_id);

-- A score may not exceed the assessment it belongs to, and both must live in
-- the same school as the enrollment being marked.
create or replace function app.score_consistency()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare limit_score numeric;
begin
  select a.max_score into limit_score
  from public.assessments a
  where a.id = new.assessment_id and a.school_id = new.school_id;

  if limit_score is null then
    raise exception 'assessment belongs to another school';
  end if;
  if new.score > limit_score then
    raise exception 'score % exceeds the assessment maximum of %', new.score, limit_score;
  end if;
  if not exists (select 1 from public.enrollments e
                 where e.id = new.enrollment_id and e.school_id = new.school_id) then
    raise exception 'enrollment belongs to another school';
  end if;
  return new;
end;
$$;
create trigger assessment_scores_consistency before insert or update on public.assessment_scores
  for each row execute function app.score_consistency();

create trigger touch_assessments before update on public.assessments
  for each row execute function app.touch_updated_at();
create trigger touch_assessment_scores before update on public.assessment_scores
  for each row execute function app.touch_updated_at();
create trigger audit_assessments after insert or update or delete on public.assessments
  for each row execute function app.write_audit();
create trigger audit_assessment_scores after insert or update or delete on public.assessment_scores
  for each row execute function app.write_audit();

-- ------------------------------------------------------------- grading rules
-- Both of these read the school's own configuration. Changing a grade band in
-- Settings changes what these return, with no deployment.
create or replace function app.grade_band(target_school uuid, pct numeric)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select band
  from public.school_settings ss,
       lateral jsonb_array_elements(ss.academic_config -> 'grade_bands') as band
  where ss.school_id = target_school
    and pct >= (band ->> 'min_score')::numeric
    and pct <= (band ->> 'max_score')::numeric
  limit 1;
$$;

create or replace function app.component_weight(target_school uuid, key text)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select (c ->> 'weight')::numeric
    from public.school_settings ss,
         lateral jsonb_array_elements(ss.academic_config -> 'assessment_components') as c
    where ss.school_id = target_school and c ->> 'key' = key
    limit 1
  ), 0);
$$;

grant execute on function app.grade_band(uuid, numeric), app.component_weight(uuid, text)
  to authenticated;

-- One row per subject for one enrollment: the weighted percentage, and the
-- grade that percentage earns under this school's bands.
create or replace function public.result_sheet(p_enrollment uuid)
returns table (
  subject_id uuid,
  subject_name text,
  subject_code text,
  components jsonb,
  percentage numeric,
  grade_label text,
  remark text,
  is_pass boolean
)
language sql stable security invoker set search_path = public, pg_temp as $$
  with scored as (
    select
      a.subject_id,
      a.component_key,
      a.max_score,
      s.score,
      app.component_weight(a.school_id, a.component_key) as weight,
      a.school_id
    from public.assessment_scores s
    join public.assessments a on a.id = s.assessment_id
    where s.enrollment_id = p_enrollment
      and a.status = 'published'
  ),
  per_subject as (
    select
      scored.subject_id,
      scored.school_id,
      round(sum(scored.score / scored.max_score * scored.weight), 2) as percentage,
      jsonb_agg(jsonb_build_object(
        'component', scored.component_key,
        'score', scored.score,
        'max_score', scored.max_score,
        'weight', scored.weight
      ) order by scored.component_key) as components
    from scored
    group by scored.subject_id, scored.school_id
  )
  select
    ps.subject_id,
    sub.name,
    sub.code,
    ps.components,
    ps.percentage,
    app.grade_band(ps.school_id, ps.percentage) ->> 'label',
    app.grade_band(ps.school_id, ps.percentage) ->> 'remark',
    (app.grade_band(ps.school_id, ps.percentage) ->> 'is_pass')::boolean
  from per_subject ps
  join public.subjects sub on sub.id = ps.subject_id
  order by sub.name;
$$;
grant execute on function public.result_sheet(uuid) to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.assessments       enable row level security;
alter table public.assessment_scores enable row level security;
alter table public.assessments       force row level security;
alter table public.assessment_scores force row level security;

-- Teachers set work and mark it; administrators can too.
create or replace function app.can_teach(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(target_school, 'school_admin', 'teacher') or app.is_platform_admin();
$$;
grant execute on function app.can_teach(uuid) to authenticated;

create policy assessments_read on public.assessments for select to authenticated
  using (app.can_read(school_id));
create policy assessments_insert on public.assessments for insert to authenticated
  with check (app.can_teach(school_id));
create policy assessments_update on public.assessments for update to authenticated
  using (app.can_teach(school_id)) with check (app.can_teach(school_id));
create policy assessments_delete on public.assessments for delete to authenticated
  using (app.can_teach(school_id));

create policy assessment_scores_read on public.assessment_scores for select to authenticated
  using (app.can_read(school_id));
create policy assessment_scores_insert on public.assessment_scores for insert to authenticated
  with check (app.can_teach(school_id));
create policy assessment_scores_update on public.assessment_scores for update to authenticated
  using (app.can_teach(school_id)) with check (app.can_teach(school_id));
create policy assessment_scores_delete on public.assessment_scores for delete to authenticated
  using (app.can_teach(school_id));

-- A pupil sees an assessment once it is published, and only for their own
-- class level. A draft is the teacher's working copy and stays invisible.
create policy assessments_read_self on public.assessments for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.enrollments e
      join public.class_arms arm on arm.id = e.class_arm_id
      where e.student_id = app.my_student_id(public.assessments.school_id)
        and e.term_id = public.assessments.term_id
        and arm.class_level_id = public.assessments.class_level_id
    )
  );

-- And their own mark on it, never a classmate's.
create policy assessment_scores_read_self on public.assessment_scores for select to authenticated
  using (
    app.owns_enrollment(enrollment_id)
    and exists (
      select 1 from public.assessments a
      where a.id = public.assessment_scores.assessment_id and a.status = 'published'
    )
  );
