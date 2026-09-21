-- The previous policy selected from auth.users, which `authenticated` has no
-- privilege on, so any read of school_invitations raised 42501 instead of
-- filtering. The caller's own email is already in their JWT.
drop policy if exists school_invitations_read on public.school_invitations;

create policy school_invitations_read on public.school_invitations for select to authenticated
  using (
    app.can_admin(school_id)
    or lower(email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
