-- Fees. The checks that matter here are arithmetic and authority: an amount is
-- decided by the database and not by the caller, a confirmation credits an
-- invoice exactly once, and only a bursar or administrator may say that money
-- arrived.
--
-- Requires supabase/seed/demo.sql plus a fee structure for the pupil's level.

do $$
declare
  gf uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  gf_admin  uuid := '22222222-2222-4222-8222-222222222222';
  teacher   uuid := '33333333-3333-4333-8333-333333333333';
  pupil_uid uuid := '66666666-6666-4666-8666-666666666666';
  fs uuid; inv uuid; bal numeric; opened jsonb; res jsonb; seen bigint;
  pupil uuid; my_enrol uuid; total numeric;
  failures text[] := '{}';
begin
  select id into pupil from public.students where profile_id = pupil_uid;
  select e.id into my_enrol from public.enrollments e
    join public.terms t on t.id = e.term_id and t.is_current where e.student_id = pupil;
  select id into fs from public.fee_structures where school_id = gf limit 1;

  if fs is null then
    raise notice 'no fee structure seeded; skipping the fees suite';
    return;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_admin, 'role', 'authenticated',
                      'email', 'admin@greenfield.test')::text, true);
  set local role authenticated;

  perform public.generate_invoices(gf, fs, current_date + 21);

  -- Raising twice must not double-bill.
  if public.generate_invoices(gf, fs, current_date + 21) <> 0 then
    failures := failures || 'generate_invoices double-billed on a second run';
  end if;

  select id, total_amount into inv, total from public.invoices where enrollment_id = my_enrol;
  if inv is null then failures := failures || 'the pupil got no invoice'; end if;

  -- Optional items are listed on the structure but left off the total.
  if total <> (select coalesce(sum(amount), 0) from public.fee_items
               where fee_structure_id = fs and not is_optional) then
    failures := failures || 'invoice total does not match the compulsory items';
  end if;
  reset role;

  -- A teacher is not fee staff.
  perform set_config('request.jwt.claims',
    json_build_object('sub', teacher, 'role', 'authenticated',
                      'email', 'teacher@greenfield.test')::text, true);
  set local role authenticated;
  begin
    perform public.record_offline_payment(inv, 1000, 'cash', 'bursary');
    failures := failures || 'a teacher recorded a payment';
  exception when others then null; end;
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil_uid, 'role', 'authenticated',
                      'email', 'student@greenfield.test')::text, true);
  set local role authenticated;

  select count(*) into seen from public.invoices;
  if seen <> 1 then failures := failures || format('pupil sees %s invoices, expected 1', seen); end if;

  -- Asking to pay more than is owed is clamped to the balance.
  opened := public.begin_card_payment(inv, 999999999);
  if (opened ->> 'amount')::numeric <> total then
    failures := failures || format('overpayment not clamped: %s', opened ->> 'amount');
  end if;
  perform public.fail_card_payment(opened ->> 'reference', 'suite');

  -- A part payment, confirmed once.
  opened := public.begin_card_payment(inv, 1000);
  res := public.confirm_card_payment(opened ->> 'reference', 'SUITE-1', 1000);
  if res ->> 'status' <> 'confirmed' then failures := failures || 'confirm failed'; end if;

  -- The same reference again must not credit the invoice twice.
  res := public.confirm_card_payment(opened ->> 'reference', 'SUITE-1', 1000);
  if res ->> 'status' <> 'already_confirmed' then
    failures := failures || 'a payment was confirmed twice';
  end if;

  select balance into bal from public.invoice_balances where invoice_id = inv;
  if bal <> total - 1000 then
    failures := failures || format('balance is %s, expected %s', bal, total - 1000);
  end if;

  -- A pupil may not book their own cash, nor confirm a payment by UPDATE.
  begin
    perform public.record_offline_payment(inv, 500, 'cash', 'bursary');
    failures := failures || 'a pupil recorded their own cash payment';
  exception when others then null; end;

  update public.payments set status = 'confirmed' where invoice_id = inv and status = 'failed';
  if found then failures := failures || 'a pupil confirmed a payment by UPDATE'; end if;

  -- The provider settings are readable (public key only; no secret is stored).
  select count(*) into seen from public.school_payment_settings;
  if seen <> 1 then failures := failures || 'pupil cannot read their school payment settings'; end if;
  reset role;

  -- Nothing at all for an anonymous caller.
  set local role anon;
  select count(*) into seen from public.invoices;
  if seen <> 0 then failures := failures || 'anon read invoices'; end if;
  select count(*) into seen from public.payments;
  if seen <> 0 then failures := failures || 'anon read payments'; end if;
  select count(*) into seen from public.invoice_balances;
  if seen <> 0 then failures := failures || 'anon read the balances view'; end if;
  select count(*) into seen from public.school_payment_settings;
  if seen <> 0 then failures := failures || 'anon read payment settings'; end if;
  reset role;

  -- A pending hold subtracts from what may be charged next. Nothing used to
  -- release one, so a payer who opened checkout and pressed back was refused
  -- on an invoice they still owed in full.
  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;

  declare
    first_ref text; second_ref text; again jsonb; settled jsonb; held bigint;
  begin
    opened := public.begin_card_payment(inv);
    first_ref := opened ->> 'reference';

    again := public.begin_card_payment(inv);
    second_ref := again ->> 'reference';
    if (again ->> 'amount')::numeric <> (opened ->> 'amount')::numeric then
      failures := failures || 'an immediate retry was offered a different amount';
    end if;

    select count(*) into held from public.payments
     where invoice_id = inv and status = 'pending' and method = 'card';
    if held <> 1 then
      failures := failures || 'abandoned card holds accumulated on the invoice';
    end if;

    -- Releasing a hold must never lose money that actually moved: if the payer
    -- pressed back and paid the first one anyway, it still has to credit.
    settled := public.confirm_card_payment(first_ref, 'GW-RELEASED', 1);
    if (settled ->> 'status') <> 'confirmed' then
      failures := failures || 'a released hold the gateway confirmed did not credit the invoice';
    end if;

    -- Tidy up so the rest of the suite sees the ledger it expects.
    reset role;
    delete from public.payments where reference in (first_ref, second_ref);
    set local role authenticated;
  exception when others then
    failures := failures || ('card hold retry checks raised: ' || sqlerrm);
  end;
  reset role;

  if array_length(failures, 1) is null then
    raise notice 'fees suite: all checks passed';
  else
    raise exception 'FEE FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
