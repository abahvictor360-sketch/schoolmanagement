-- A pending card payment holds back the amount a pupil may charge next:
-- begin_card_payment computes `balance - pending`. Nothing ever cleared those
-- holds, so a payer who opened checkout twice and completed neither was told
-- "nothing left to pay on this invoice" on an invoice they still owed in full.
--
-- It was reachable before; a one-tap Pay now on the portal home makes it
-- ordinary. A gateway session does not stay open for half an hour, so a hold
-- older than that is an abandoned attempt, not money in flight.
--
-- Expired rather than ignored: the pupil sees "awaiting confirmation" built
-- from the same pending sum, and a stale hold would sit in that figure and in
-- the bursar's ledger for ever.
--
-- A timer alone does not cover the common case — tap, see the gateway, press
-- back, tap again — so a payer's own holds on the invoice are released
-- whenever they open a new checkout: one person can only be at one checkout.
-- That is only safe because confirm_card_payment below now accepts a released
-- hold the gateway says was paid. Releasing a hold must never be able to lose
-- money that actually moved.

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

  -- Release abandoned checkouts before working out what is still owed. Only
  -- card holds: an offline payment is never pending, and a bank transfer a
  -- bursar is still confirming must not be swept away by a timer.
  --
  -- This caller's own holds go immediately (they are here opening another
  -- one); anyone else's only once they are too old to be a live session.
  update public.payments
     set status = 'failed',
         note = coalesce(note, 'Checkout abandoned; hold released automatically.')
   where invoice_id = p_invoice_id
     and status = 'pending'
     and method = 'card'
     and (payer_user_id = auth.uid() or created_at < now() - interval '30 minutes');

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

-- The other half of the change above. The gateway, not this table, is the
-- authority on whether money moved: a hold released as abandoned that the
-- gateway then reports as paid must still credit the invoice, or a payer who
-- pressed back and paid anyway loses their money.
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
  if pay.status not in ('pending', 'failed') then
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
         confirmed_at = now(),
         note = case
                  when pay.status = 'failed'
                  then 'Hold had been released; the gateway confirmed payment afterwards.'
                  else note
                end
   where id = pay.id;

  return jsonb_build_object('status', 'confirmed', 'amount', coalesce(p_amount_paid, pay.amount));
end;
$$;
