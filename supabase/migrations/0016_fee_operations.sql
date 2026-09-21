-- Fee operations. Every one of these exists so that an amount, a payer or a
-- confirmation is decided by the database rather than by whatever the browser
-- posted.

-- Raise one invoice per active enrollment at a fee structure's class level and
-- term, copying the line items so the bill is a snapshot. Idempotent: running
-- it twice does not double-bill, because of unique (enrollment, structure).
create or replace function public.generate_invoices(
  p_school_id uuid, p_fee_structure_id uuid, p_due_on date default null
) returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  fs record;
  total numeric(12,2);
  created integer := 0;
  next_seq integer;
begin
  if not app.can_manage_fees(p_school_id) then
    raise exception 'only a bursar or administrator may raise invoices' using errcode = '42501';
  end if;

  select * into fs from public.fee_structures
   where id = p_fee_structure_id and school_id = p_school_id;
  if fs is null then
    raise exception 'fee structure not found' using errcode = '42501';
  end if;

  select coalesce(sum(amount), 0) into total
    from public.fee_items where fee_structure_id = p_fee_structure_id and not is_optional;

  select coalesce(max(substring(invoice_number from '[0-9]+$')::integer), 0) + 1
    into next_seq
    from public.invoices where school_id = p_school_id;

  -- Two steps rather than one CTE: the second is idempotent on its own, so a
  -- run interrupted between them can simply be repeated.
  with candidates as (
    select e.id as enrollment_id,
           row_number() over (order by e.id) - 1 as seq_offset
    from public.enrollments e
    join public.class_arms arm on arm.id = e.class_arm_id
    where e.school_id = p_school_id
      and e.term_id = fs.term_id
      and e.status = 'active'
      and arm.class_level_id = fs.class_level_id
      and not exists (
        select 1 from public.invoices i
        where i.enrollment_id = e.id and i.fee_structure_id = p_fee_structure_id
      )
  )
  insert into public.invoices
    (school_id, enrollment_id, fee_structure_id, invoice_number, total_amount, due_on)
  select p_school_id, c.enrollment_id, p_fee_structure_id,
         'INV-' || lpad((next_seq + c.seq_offset)::text, 6, '0'),
         total, p_due_on
  from candidates c;

  get diagnostics created = row_count;

  -- Snapshot the line items onto any invoice of this structure that has none.
  insert into public.invoice_items (school_id, invoice_id, label, amount, ordinal)
  select p_school_id, i.id, fi.label, fi.amount, fi.ordinal
  from public.invoices i
  cross join public.fee_items fi
  where i.fee_structure_id = p_fee_structure_id
    and fi.fee_structure_id = p_fee_structure_id
    and not fi.is_optional
    and not exists (select 1 from public.invoice_items ii where ii.invoice_id = i.id);

  return created;
end;
$$;

-- Opens a card payment. The amount is read from the outstanding balance here,
-- not taken from the caller, so a tampered form cannot change what is owed.
-- Returns the reference the gateway will echo back.
create or replace function public.begin_card_payment(
  p_invoice_id uuid,
  p_amount numeric default null,
  p_payer_kind app.payer_kind default 'student',
  p_payer_guardian_id uuid default null,
  p_payer_name text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv record;
  outstanding numeric(12,2);
  pending numeric(12,2);
  charge numeric(12,2);
  ref text;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if inv is null then
    raise exception 'invoice not found' using errcode = '42501';
  end if;

  -- The payer must be either the pupil this invoice belongs to, or fee staff
  -- taking a payment at the counter.
  if not (app.owns_enrollment(inv.enrollment_id) or app.can_manage_fees(inv.school_id)) then
    raise exception 'not your invoice' using errcode = '42501';
  end if;

  if inv.status <> 'issued' then
    raise exception 'this invoice is not open for payment' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into pending
    from public.payments where invoice_id = p_invoice_id and status = 'pending';

  outstanding := app.invoice_balance(p_invoice_id) - pending;

  if outstanding <= 0 then
    raise exception 'nothing left to pay on this invoice' using errcode = '22023';
  end if;

  charge := least(coalesce(p_amount, outstanding), outstanding);
  if charge <= 0 then
    raise exception 'the amount must be more than zero' using errcode = '22023';
  end if;

  ref := 'SH-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.payments (
    school_id, invoice_id, amount, method, status, payer_kind,
    payer_user_id, payer_guardian_id, payer_name, reference, provider
  ) values (
    inv.school_id, p_invoice_id, charge, 'card', 'pending', p_payer_kind,
    auth.uid(), p_payer_guardian_id, p_payer_name, ref, 'paystack'
  );

  return jsonb_build_object('reference', ref, 'amount', charge, 'school_id', inv.school_id);
end;
$$;

-- Marks a card payment confirmed. The caller has already verified the
-- transaction with the gateway server-side; this checks that the person asking
-- is entitled to touch the row, and that the gateway's amount matches ours.
create or replace function public.confirm_card_payment(
  p_reference text, p_provider_reference text, p_amount_paid numeric
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare pay record; inv record;
begin
  select * into pay from public.payments where reference = p_reference;
  if pay is null then
    raise exception 'payment not found' using errcode = '42501';
  end if;

  select * into inv from public.invoices where id = pay.invoice_id;
  if not (app.owns_enrollment(inv.enrollment_id) or app.can_manage_fees(pay.school_id)) then
    raise exception 'not your payment' using errcode = '42501';
  end if;

  -- Confirming twice is a no-op rather than an error: a gateway redirect and a
  -- bursar reconciling the same payment must not fight.
  if pay.status = 'confirmed' then
    return jsonb_build_object('status', 'already_confirmed', 'amount', pay.amount);
  end if;
  if pay.status <> 'pending' then
    raise exception 'this payment is % and cannot be confirmed', pay.status using errcode = '22023';
  end if;

  -- The gateway is the authority on what was actually collected. If it differs
  -- from what we opened, record what was really paid.
  update public.payments
     set status = 'confirmed',
         amount = coalesce(p_amount_paid, amount),
         provider_reference = p_provider_reference,
         paid_at = now(),
         confirmed_by = auth.uid(),
         confirmed_at = now()
   where id = pay.id;

  return jsonb_build_object('status', 'confirmed', 'amount', coalesce(p_amount_paid, pay.amount));
end;
$$;

create or replace function public.fail_card_payment(p_reference text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pay record; inv record;
begin
  select * into pay from public.payments where reference = p_reference;
  if pay is null then return; end if;
  select * into inv from public.invoices where id = pay.invoice_id;
  if not (app.owns_enrollment(inv.enrollment_id) or app.can_manage_fees(pay.school_id)) then
    raise exception 'not your payment' using errcode = '42501';
  end if;
  if pay.status = 'pending' then
    update public.payments set status = 'failed', note = coalesce(p_note, note) where id = pay.id;
  end if;
end;
$$;

-- Cash at the bursary, a bank transfer, a POS terminal or a waiver. Staff only,
-- and confirmed the moment it is recorded because a human has seen the money.
create or replace function public.record_offline_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method app.payment_method,
  p_payer_kind app.payer_kind,
  p_payer_guardian_id uuid default null,
  p_payer_name text default null,
  p_note text default null
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare inv record; outstanding numeric(12,2); new_id uuid;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if inv is null or not app.can_manage_fees(inv.school_id) then
    raise exception 'only a bursar or administrator may record a payment' using errcode = '42501';
  end if;
  if p_method = 'card' then
    raise exception 'card payments go through the gateway, not this function' using errcode = '22023';
  end if;

  outstanding := app.invoice_balance(p_invoice_id);
  if p_amount > outstanding then
    raise exception 'that is more than the % outstanding on this invoice', outstanding
      using errcode = '22023';
  end if;

  insert into public.payments (
    school_id, invoice_id, amount, method, status, payer_kind,
    payer_guardian_id, payer_name, reference, note,
    paid_at, confirmed_by, confirmed_at
  ) values (
    inv.school_id, p_invoice_id, p_amount, p_method, 'confirmed', p_payer_kind,
    p_payer_guardian_id, p_payer_name,
    'SH-' || replace(gen_random_uuid()::text, '-', ''), p_note,
    now(), auth.uid(), now()
  ) returning id into new_id;

  return new_id;
end;
$$;

-- Deny by default, as with every other RPC.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.generate_invoices(uuid, uuid, date)',
    'public.begin_card_payment(uuid, numeric, app.payer_kind, uuid, text)',
    'public.confirm_card_payment(text, text, numeric)',
    'public.fail_card_payment(text, text)',
    'public.record_offline_payment(uuid, numeric, app.payment_method, app.payer_kind, uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
