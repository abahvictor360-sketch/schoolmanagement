-- Platform billing: a school subscribes monthly or yearly to use SchoolHub.
--
-- SPEC.md §8 put billing outside Release 1. The owner opened it deliberately,
-- the same way Release 2 was opened. CLAUDE.md records the new boundary.
--
-- Three decisions shape everything below.
--
--   1. State is DERIVED, never stored. There is no cron in this deployment, so
--      a `status` column would go stale the moment a period rolled over with
--      nobody watching. `app.subscription_state()` computes the state from the
--      stored dates on every read, so it cannot drift and nothing has to run.
--
--   2. Enforcement is in RLS, not in server actions. A signed-in user holds a
--      JWT that reaches PostgREST directly, so an application-layer gate is a
--      suggestion. The write policies carry the check.
--
--   3. A school with no subscription row is 'unbilled' and writes freely. That
--      grandfathers every school created before this migration and keeps the
--      existing RLS suites meaningful. New schools get a trial row on
--      creation, so only pre-existing ones are free.

-- ------------------------------------------------------------------ plans
create table public.billing_plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  -- The top band is open-ended, so null means "no ceiling".
  max_students  integer,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  yearly_amount  numeric(12,2) not null check (yearly_amount  >= 0),
  currency      text not null default 'NGN',
  sort_order    integer not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint billing_plans_band_positive check (max_students is null or max_students > 0)
);

create unique index billing_plans_sort_idx on public.billing_plans (sort_order);

insert into public.billing_plans
  (code, name, max_students, monthly_amount, yearly_amount, sort_order)
values
  ('starter', 'Starter', 200,   15000,  150000, 1),
  ('growth',  'Growth',  600,   35000,  350000, 2),
  ('scale',   'Scale',   1500,  70000,  700000, 3),
  ('group',   'Group',   null, 140000, 1400000, 4);

-- ---------------------------------------------------------- subscriptions
create type public.billing_interval as enum ('monthly', 'yearly');

create table public.school_subscriptions (
  school_id            uuid primary key references public.schools(id) on delete cascade,
  plan_id              uuid not null references public.billing_plans(id),
  billing_interval     public.billing_interval not null default 'monthly',
  trial_ends_on        date,
  current_period_start date not null default current_date,
  current_period_end   date not null,
  -- Days after the period ends during which the school still writes. A bank
  -- transfer in Nigeria can take three working days; one delay must not stop
  -- a register being taken.
  grace_days           integer not null default 7 check (grace_days between 0 and 60),
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint school_subscriptions_period_ordered
    check (current_period_end >= current_period_start)
);

-- -------------------------------------------------------------- charges
create table public.billing_charges (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  plan_id       uuid not null references public.billing_plans(id),
  billing_interval public.billing_interval not null,
  period_start  date not null,
  period_end    date not null,
  -- Frozen at the moment the charge was raised. The bill has to stay
  -- defensible months later, when the roll has moved on.
  student_count integer not null check (student_count >= 0),
  amount        numeric(12,2) not null check (amount >= 0),
  currency      text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'failed', 'abandoned')),
  provider      text check (provider in ('paystack', 'flutterwave', 'remita', 'stripe')),
  provider_reference text unique,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint billing_charges_paid_has_time
    check ((status = 'paid') = (paid_at is not null))
);

create index billing_charges_school_idx on public.billing_charges (school_id, created_at desc);
create index billing_charges_plan_idx   on public.billing_charges (plan_id);
create index school_subscriptions_plan_idx on public.school_subscriptions (plan_id);

-- ------------------------------------------------------------- the state
--
-- 'unbilled'  no subscription row — a school from before billing existed
-- 'trialing'  inside the free trial
-- 'active'    inside a paid period
-- 'past_due'  period ended, still inside grace; writes continue, banner shows
-- 'read_only' grace spent; staff read everything, save nothing
-- 'canceled'  cancelled and the paid period has run out
create or replace function app.subscription_state(target_school uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
      when s.canceled_at is not null and current_date > s.current_period_end then 'canceled'
      when s.trial_ends_on is not null and current_date <= s.trial_ends_on   then 'trialing'
      when current_date <= s.current_period_end                              then 'active'
      when current_date <= s.current_period_end + s.grace_days               then 'past_due'
      else 'read_only'
    end
    from public.school_subscriptions s
    where s.school_id = target_school
  ), 'unbilled');
$$;

create or replace function app.billing_permits_writes(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.subscription_state(target_school)
           in ('unbilled', 'trialing', 'active', 'past_due');
$$;

grant execute on function app.subscription_state(uuid),
                         app.billing_permits_writes(uuid) to authenticated;

-- --------------------------------------------------------------- pricing
create or replace function app.active_student_count(target_school uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.students
   where school_id = target_school and status = 'active';
$$;

/** The cheapest band that still holds this many pupils. */
create or replace function app.plan_for_student_count(head_count integer)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.billing_plans p
   where p.is_active and (p.max_students is null or p.max_students >= head_count)
   order by p.sort_order
   limit 1;
$$;

grant execute on function app.active_student_count(uuid),
                         app.plan_for_student_count(integer) to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.billing_plans         enable row level security;
alter table public.billing_plans         force  row level security;
alter table public.school_subscriptions  enable row level security;
alter table public.school_subscriptions  force  row level security;
alter table public.billing_charges       enable row level security;
alter table public.billing_charges       force  row level security;

-- The price list is not a secret; a school has to see what it would pay.
create policy billing_plans_read on public.billing_plans
  for select to authenticated using (true);
create policy billing_plans_insert on public.billing_plans
  for insert to authenticated with check (app.is_platform_admin());
create policy billing_plans_update on public.billing_plans
  for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy billing_plans_delete on public.billing_plans
  for delete to authenticated using (app.is_platform_admin());

-- A school's own bill is for whoever handles its money, plus the platform.
create policy school_subscriptions_read on public.school_subscriptions
  for select to authenticated
  using (app.has_role(school_id, 'school_admin', 'bursar') or app.is_platform_admin());
create policy school_subscriptions_insert on public.school_subscriptions
  for insert to authenticated with check (app.is_platform_admin());
create policy school_subscriptions_update on public.school_subscriptions
  for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy school_subscriptions_delete on public.school_subscriptions
  for delete to authenticated using (app.is_platform_admin());

create policy billing_charges_read on public.billing_charges
  for select to authenticated
  using (app.has_role(school_id, 'school_admin', 'bursar') or app.is_platform_admin());
create policy billing_charges_insert on public.billing_charges
  for insert to authenticated with check (app.is_platform_admin());
create policy billing_charges_update on public.billing_charges
  for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy billing_charges_delete on public.billing_charges
  for delete to authenticated using (app.is_platform_admin());

-- Note what is deliberately absent: no school-side insert or update on
-- subscriptions or charges. A school starts and settles a charge through the
-- security definer functions below, which decide the amount themselves. If a
-- school could write these rows it could write its own price.

-- ------------------------------------------- the gate on every staff write
--
-- Reads are untouched everywhere. A read-only school still opens every
-- register, report card and pupil record it ever created.
--
-- Two paths stay open on purpose:
--   · messaging — cutting a child off from their teacher over an unpaid
--     invoice punishes the wrong person, and it applies no useful pressure.
--   · a parent paying school fees, and a pupil finishing a published test —
--     both run through security definer functions that are not gated below.
do $$
declare t text;
begin
  foreach t in array array['school_settings','academic_sessions','terms','class_levels',
      'class_arms','subjects','staff','class_subjects','students','guardians',
      'student_guardians','enrollments','school_invitations'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (app.can_admin(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (app.can_admin(school_id))
                      with check (app.can_admin(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (app.can_admin(school_id)
                             and app.billing_permits_writes(school_id))', t);
  end loop;

  foreach t in array array['attendance_registers','attendance_entries'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (app.can_take_attendance(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (app.can_take_attendance(school_id))
                      with check (app.can_take_attendance(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (app.can_take_attendance(school_id)
                             and app.billing_permits_writes(school_id))', t);
  end loop;

  foreach t in array array['assessments','assessment_scores'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (app.can_teach(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (app.can_teach(school_id))
                      with check (app.can_teach(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (app.can_teach(school_id)
                             and app.billing_permits_writes(school_id))', t);
  end loop;

  -- Staff authoring of tests. The pupil-facing sitting path is separate and
  -- runs through security definer functions, so an exam already under way is
  -- not interrupted by the school's invoice.
  foreach t in array array['cbt_tests','cbt_questions','cbt_options','cbt_answer_keys'] loop
    execute format('drop policy if exists %1$s_staff_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_staff_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_staff_delete on public.%1$s', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated
                      with check (app.can_teach(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated
                      using (app.can_teach(school_id))
                      with check (app.can_teach(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated
                      using (app.can_teach(school_id)
                             and app.billing_permits_writes(school_id))', t);
  end loop;

  foreach t in array array['fee_structures','fee_items','invoices','invoice_items','payments'] loop
    execute format('drop policy if exists %1$s_staff_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_staff_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_staff_delete on public.%1$s', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated
                      with check (app.can_manage_fees(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated
                      using (app.can_manage_fees(school_id))
                      with check (app.can_manage_fees(school_id)
                                  and app.billing_permits_writes(school_id))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated
                      using (app.can_manage_fees(school_id)
                             and app.billing_permits_writes(school_id))', t);
  end loop;
end $$;

-- ------------------------------------------------- audit the billing rows
create trigger audit_school_subscriptions
  after insert or update or delete on public.school_subscriptions
  for each row execute function app.write_audit();
create trigger audit_billing_charges
  after insert or update or delete on public.billing_charges
  for each row execute function app.write_audit();

-- ------------------------------------------------------- operations
--
-- These are the only writers of subscriptions and charges. They are security
-- definer so they can write rows the school itself may not, which is the point:
-- the school asks to pay, the database decides what for and how much.

/**
 * Raise a pending charge for the next period and return what to collect.
 * The band is chosen from the pupil roll now, and frozen on the charge.
 */
create or replace function public.start_subscription_checkout(
  target_school    uuid,
  chosen_interval  public.billing_interval
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  head_count  integer;
  plan        public.billing_plans;
  price       numeric(12,2);
  ref         text;
  new_start   date;
  new_end     date;
  charge_id   uuid;
begin
  if not (app.has_role(target_school, 'school_admin') or app.is_platform_admin()) then
    raise exception 'Only a school administrator may start a subscription payment'
      using errcode = '42501';
  end if;

  head_count := app.active_student_count(target_school);
  select * into plan from public.billing_plans
   where id = app.plan_for_student_count(head_count);
  if plan.id is null then
    raise exception 'No active plan covers % pupils', head_count using errcode = 'P0002';
  end if;

  price := case chosen_interval
             when 'monthly' then plan.monthly_amount
             else plan.yearly_amount
           end;

  -- Renewal runs from the end of the period already bought, so paying early
  -- never costs a school the days it has paid for. A lapsed school restarts
  -- from today rather than back-dating into a period it did not have.
  select greatest(s.current_period_end, current_date) into new_start
    from public.school_subscriptions s where s.school_id = target_school;
  new_start := coalesce(new_start, current_date);
  new_end := (case chosen_interval
                when 'monthly' then new_start + interval '1 month'
                else                new_start + interval '1 year'
              end)::date;

  ref := 'sub_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.billing_charges (
    school_id, plan_id, billing_interval, period_start, period_end,
    student_count, amount, currency, status, provider_reference
  ) values (
    target_school, plan.id, chosen_interval, new_start, new_end,
    head_count, price, plan.currency, 'pending', ref
  ) returning id into charge_id;

  return jsonb_build_object(
    'charge_id', charge_id, 'reference', ref, 'amount', price,
    'currency', plan.currency, 'plan', plan.name, 'plan_code', plan.code,
    'student_count', head_count, 'period_start', new_start, 'period_end', new_end
  );
end $$;

/**
 * Settle a charge and move the subscription forward. Idempotent: the update is
 * conditional on the row not already being paid, so a repeated callback cannot
 * buy a second period.
 */
create or replace function public.confirm_subscription_payment(
  charge_reference text,
  paid_provider    text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c       public.billing_charges;
  settled integer;
begin
  select * into c from public.billing_charges where provider_reference = charge_reference;
  if c.id is null then
    raise exception 'Unknown payment reference' using errcode = 'P0002';
  end if;
  if not (app.has_role(c.school_id, 'school_admin') or app.is_platform_admin()) then
    raise exception 'That payment belongs to another school' using errcode = '42501';
  end if;

  update public.billing_charges
     set status = 'paid', paid_at = now(), provider = paid_provider, updated_at = now()
   where id = c.id and status <> 'paid';
  get diagnostics settled = row_count;

  if settled = 0 then
    return jsonb_build_object('charge_id', c.id, 'already_paid', true,
                              'state', app.subscription_state(c.school_id));
  end if;

  insert into public.school_subscriptions (
    school_id, plan_id, billing_interval,
    current_period_start, current_period_end, trial_ends_on
  ) values (
    c.school_id, c.plan_id, c.billing_interval, c.period_start, c.period_end, null
  )
  on conflict (school_id) do update
     set plan_id              = excluded.plan_id,
         billing_interval     = excluded.billing_interval,
         current_period_start = excluded.current_period_start,
         current_period_end   = excluded.current_period_end,
         trial_ends_on        = null,   -- a trial is spent the moment they pay
         canceled_at          = null,
         updated_at           = now();

  return jsonb_build_object('charge_id', c.id, 'already_paid', false,
                            'period_end', c.period_end,
                            'state', app.subscription_state(c.school_id));
end $$;

/** Abandon a checkout the school walked away from. */
create or replace function public.abandon_subscription_charge(charge_reference text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.billing_charges;
begin
  select * into c from public.billing_charges where provider_reference = charge_reference;
  if c.id is null then return; end if;
  if not (app.has_role(c.school_id, 'school_admin') or app.is_platform_admin()) then
    raise exception 'That payment belongs to another school' using errcode = '42501';
  end if;
  update public.billing_charges set status = 'abandoned', updated_at = now()
   where id = c.id and status = 'pending';
end $$;

/** Platform admin: place a school on a plan, extend it, or grant a trial. */
create or replace function public.set_school_subscription(
  target_school   uuid,
  plan_code       text,
  chosen_interval public.billing_interval default 'monthly',
  period_end      date default null,
  trial_ends      date default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare chosen uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrators only' using errcode = '42501';
  end if;
  select id into chosen from public.billing_plans where code = plan_code and is_active;
  if chosen is null then
    raise exception 'No active plan with code %', plan_code using errcode = 'P0002';
  end if;

  insert into public.school_subscriptions (
    school_id, plan_id, billing_interval,
    current_period_start, current_period_end, trial_ends_on
  ) values (
    target_school, chosen, chosen_interval, current_date,
    coalesce(period_end, trial_ends, current_date + 30), trial_ends
  )
  on conflict (school_id) do update
     set plan_id          = excluded.plan_id,
         billing_interval = excluded.billing_interval,
         current_period_end = coalesce(period_end, school_subscriptions.current_period_end),
         trial_ends_on    = coalesce(trial_ends, school_subscriptions.trial_ends_on),
         canceled_at      = null,
         updated_at       = now();
end $$;

/** A school stops renewing. It keeps what it has paid for until that runs out. */
create or replace function public.cancel_subscription(target_school uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not (app.has_role(target_school, 'school_admin') or app.is_platform_admin()) then
    raise exception 'Only a school administrator may cancel' using errcode = '42501';
  end if;
  update public.school_subscriptions
     set canceled_at = now(), updated_at = now()
   where school_id = target_school;
end $$;

-- Every new school starts on a 30-day trial. A trigger rather than a change to
-- create_school, so a school made any other way is still billed.
create or replace function app.start_trial_for_new_school()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare starter uuid;
begin
  starter := app.plan_for_student_count(0);
  if starter is null then return new; end if;
  insert into public.school_subscriptions (
    school_id, plan_id, billing_interval, trial_ends_on,
    current_period_start, current_period_end
  ) values (
    new.id, starter, 'monthly', current_date + 30, current_date, current_date + 30
  ) on conflict (school_id) do nothing;
  return new;
end $$;

create trigger schools_start_trial after insert on public.schools
  for each row execute function app.start_trial_for_new_school();

-- Postgres grants EXECUTE to PUBLIC by default, which would leave these
-- callable by anon. Migration 0014 closed that for the rest of the API.
revoke execute on function
  public.start_subscription_checkout(uuid, public.billing_interval),
  public.confirm_subscription_payment(text, text),
  public.abandon_subscription_charge(text),
  public.set_school_subscription(uuid, text, public.billing_interval, date, date),
  public.cancel_subscription(uuid)
  from public, anon;

grant execute on function
  public.start_subscription_checkout(uuid, public.billing_interval),
  public.confirm_subscription_payment(text, text),
  public.abandon_subscription_charge(text),
  public.set_school_subscription(uuid, text, public.billing_interval, date, date),
  public.cancel_subscription(uuid)
  to authenticated;
