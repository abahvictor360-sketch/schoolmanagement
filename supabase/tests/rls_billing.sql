-- Platform billing. Three things have to hold at once, and they pull against
-- each other:
--
--   · A school that has not paid must not be able to write.
--   · It must still be able to READ everything it ever entered, and to pay its
--     way back in. A gate a school cannot get through is a gate that loses the
--     customer and the data with them.
--   · A school must never be able to price itself, extend itself, or mark its
--     own charge paid.
--
-- Requires supabase/seed/demo.sql.

do $$
declare
  gf        uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  bs        uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  gf_admin  uuid := '22222222-2222-4222-8222-222222222222';
  gf_teach  uuid := '33333333-3333-4333-8333-333333333333';
  bs_admin  uuid := '44444444-4444-4444-8444-444444444444';
  pupil_uid uuid := '66666666-6666-4666-8666-666666666666';
  growth uuid; starter uuid; n bigint; co jsonb; res jsonb;
  arm uuid; term uuid;
  failures text[] := '{}';
begin
  select id into growth  from public.billing_plans where code = 'growth';
  select id into starter from public.billing_plans where code = 'starter';

  -- ---------------------------------------------------------------- bands
  if app.plan_for_student_count(0)    <> starter then failures := failures || 'band: 0 pupils is not Starter'; end if;
  if app.plan_for_student_count(200)  <> starter then failures := failures || 'band: 200 pupils is not Starter'; end if;
  if app.plan_for_student_count(201)  <> growth  then failures := failures || 'band: 201 pupils is not Growth'; end if;
  if app.plan_for_student_count(100000) is null  then failures := failures || 'band: no plan covers a very large school'; end if;

  -- ------------------------------------------------- state is derived
  delete from public.school_subscriptions where school_id = gf;
  if app.subscription_state(gf) <> 'unbilled' then
    failures := failures || 'a school with no row is not unbilled';
  end if;
  if not app.billing_permits_writes(gf) then
    failures := failures || 'an unbilled school was blocked from writing';
  end if;
  insert into public.school_subscriptions
    (school_id, plan_id, current_period_start, current_period_end, trial_ends_on)
  values (gf, growth, current_date, current_date + 30, current_date + 30);
  if app.subscription_state(gf) <> 'trialing' then failures := failures || 'trial did not read as trialing'; end if;
  if not app.billing_permits_writes(gf) then failures := failures || 'a trialing school could not write'; end if;
  update public.school_subscriptions
     set trial_ends_on = null, current_period_start = current_date - 10,
         current_period_end = current_date + 20 where school_id = gf;
  if app.subscription_state(gf) <> 'active' then failures := failures || 'a paid period did not read as active'; end if;
  -- Ended three days ago, seven days of grace: still writing, with a warning.
  update public.school_subscriptions
     set current_period_start = current_date - 33, current_period_end = current_date - 3
   where school_id = gf;
  if app.subscription_state(gf) <> 'past_due' then failures := failures || 'inside grace did not read as past_due'; end if;
  if not app.billing_permits_writes(gf) then failures := failures || 'a school inside its grace days was already blocked'; end if;
  -- Grace spent.
  update public.school_subscriptions
     set current_period_start = current_date - 60, current_period_end = current_date - 30
   where school_id = gf;
  if app.subscription_state(gf) <> 'read_only' then failures := failures || 'past grace did not read as read_only'; end if;
  if app.billing_permits_writes(gf) then failures := failures || 'a lapsed school was still allowed to write'; end if;
  update public.school_subscriptions set canceled_at = now() where school_id = gf;
  if app.subscription_state(gf) <> 'canceled' then failures := failures || 'a cancelled, expired school did not read as canceled'; end if;
  update public.school_subscriptions set canceled_at = null where school_id = gf;

  -- ------------------------------------ read_only: reads live, writes die
  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_admin, 'role', 'authenticated',
                      'email', 'admin@greenfield.test')::text, true);
  set local role authenticated;
  select count(*) into n from public.students where school_id = gf;
  if n = 0 then failures := failures || 'a lapsed school lost sight of its own pupils'; end if;
  select count(*) into n from public.attendance_registers where school_id = gf;
  if n = 0 then failures := failures || 'a lapsed school lost sight of its own registers'; end if;
  begin
    insert into public.subjects (school_id, name, code) values (gf, 'Gate probe', 'GATEPROBE');
    failures := failures || 'a lapsed school inserted a subject';
  exception when others then null;
  end;
  -- The update policy keeps its USING clause open and rejects in WITH CHECK,
  -- so this raises rather than quietly matching no rows. That is the better
  -- failure: a silent no-op would let the application believe it had saved.
  begin
    update public.students set first_name = first_name
     where id = (select id from public.students where school_id = gf limit 1);
    failures := failures || 'a lapsed school updated a pupil';
  exception when others then null;
  end;
  -- The staff RPCs are security invoker, so the policies above cover them.
  -- This proves that rather than assuming it.
  select ca.id, t.id into arm, term
    from public.class_arms ca
    join public.terms t on t.school_id = ca.school_id and t.is_current
   where ca.school_id = gf limit 1;
  if arm is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', gf_teach, 'role', 'authenticated')::text, true);
    begin
      perform public.save_attendance(gf, arm, term, current_date, '[]'::jsonb);
      failures := failures || 'save_attendance wrote for a lapsed school';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims',
      json_build_object('sub', gf_admin, 'role', 'authenticated')::text, true);
  end if;

  -- --------------------------------------------- a school cannot self-deal
  update public.school_subscriptions set current_period_end = current_date + 365
   where school_id = gf;
  if found then failures := failures || 'a school administrator extended their own subscription'; end if;
  begin
    insert into public.billing_charges
      (school_id, plan_id, billing_interval, period_start, period_end,
       student_count, amount, currency, status, paid_at)
    values (gf, growth, 'yearly', current_date, current_date + 365, 1, 1, 'NGN', 'paid', now());
    failures := failures || 'a school administrator wrote their own paid charge';
  exception when others then null;
  end;

  -- --------------------------------------- paying its way back in must work
  co := public.start_subscription_checkout(gf, 'yearly');
  if (co->>'amount')::numeric <> (select yearly_amount from public.billing_plans where id = growth) then
    failures := failures || 'checkout did not price the school on its own band';
  end if;
  if (co->>'period_start')::date <> current_date then
    failures := failures || 'a lapsed school was back-dated into a period it never had';
  end if;
  res := public.confirm_subscription_payment(co->>'reference', 'paystack');
  if (res->>'already_paid')::boolean then failures := failures || 'a first confirmation reported as a replay'; end if;
  if app.subscription_state(gf) <> 'active' then failures := failures || 'paying did not restore the subscription'; end if;
  -- A gateway that calls back twice must not sell a second year.
  res := public.confirm_subscription_payment(co->>'reference', 'paystack');
  if not (res->>'already_paid')::boolean then failures := failures || 'a replayed confirmation was treated as new'; end if;
  select count(*) into n from public.billing_charges
   where school_id = gf and status = 'paid' and provider_reference = co->>'reference';
  if n <> 1 then failures := failures || 'a replayed confirmation duplicated the charge'; end if;
  insert into public.subjects (school_id, name, code) values (gf, 'Gate probe', 'GATEPROBE');
  delete from public.subjects where school_id = gf and code = 'GATEPROBE';

  -- --------------------------------------------------------- cross-tenant
  perform set_config('request.jwt.claims',
    json_build_object('sub', bs_admin, 'role', 'authenticated',
                      'email', 'admin@brightstar.test')::text, true);
  select count(*) into n from public.school_subscriptions where school_id = gf;
  if n <> 0 then failures := failures || 'another school read Greenfield''s subscription'; end if;
  select count(*) into n from public.billing_charges where school_id = gf;
  if n <> 0 then failures := failures || 'another school read Greenfield''s charges'; end if;
  begin
    perform public.start_subscription_checkout(gf, 'monthly');
    failures := failures || 'another school started a charge against Greenfield';
  exception when others then null;
  end;
  -- A pupil has no business seeing what the school pays to run the software.
  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil_uid, 'role', 'authenticated')::text, true);
  select count(*) into n from public.school_subscriptions;
  if n <> 0 then failures := failures || 'a pupil read a school subscription'; end if;
  select count(*) into n from public.billing_charges;
  if n <> 0 then failures := failures || 'a pupil read a billing charge'; end if;
  reset role;
  -- The price list is deliberately public to signed-in users, but anonymous
  -- callers get nothing at all.
  set local role anon;
  select count(*) into n from public.school_subscriptions;
  if n <> 0 then failures := failures || 'anon read subscriptions'; end if;
  select count(*) into n from public.billing_charges;
  if n <> 0 then failures := failures || 'anon read charges'; end if;
  begin
    perform public.start_subscription_checkout(gf, 'monthly');
    failures := failures || 'anon called start_subscription_checkout';
  exception when others then null;
  end;
  reset role;
  -- Leave the demo school on a trial so a re-run starts from the same place.
  delete from public.billing_charges where school_id = gf;
  delete from public.school_subscriptions where school_id = gf;
  insert into public.school_subscriptions
    (school_id, plan_id, current_period_start, current_period_end, trial_ends_on)
  values (gf, growth, current_date, current_date + 30, current_date + 30);
  if array_length(failures, 1) is null then
    raise notice 'billing suite: all checks passed';
  else
    raise exception 'BILLING FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
