-- The marketing page quotes prices, and it is served to people who are not
-- signed in. billing_plans_read was `to authenticated`, so the pricing section
-- would have rendered empty for every visitor who had not logged in.
--
-- Publishing a price list is the point of a price list. Nothing else about
-- billing moves: subscriptions and charges stay invisible to anon, and the
-- write policies are untouched.
drop policy if exists billing_plans_read on public.billing_plans;
create policy billing_plans_read on public.billing_plans
  for select to anon, authenticated using (is_active);
