-- Messaging, with the constraint that one side of every conversation is a
-- child: a pupil may write to staff of their own school and to nobody else,
-- the school's administrators can read the thread because it is a
-- safeguarding record rather than private mail, and no message can be edited
-- after it is sent.
--
-- Requires supabase/seed/demo.sql.

do $$
declare
  gf uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  bs uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  pupil_uid   uuid := '66666666-6666-4666-8666-666666666666';
  other_pupil uuid := '77777777-7777-4777-8777-777777777777';
  gf_teacher  uuid := '33333333-3333-4333-8333-333333333333';
  bs_admin    uuid := '44444444-4444-4444-8444-444444444444';
  gf_admin    uuid := '22222222-2222-4222-8222-222222222222';
  thread uuid; seen bigint; affected bigint; msg uuid; restored boolean := false;
  failures text[] := '{}';
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pupil_uid, 'role', 'authenticated',
                      'email', 'student@greenfield.test')::text, true);
  set local role authenticated;

  select count(*) into seen from public.messageable_staff(gf);
  if seen = 0 then failures := failures || 'pupil has nobody to write to'; end if;
  select count(*) into seen from public.messageable_staff(bs);
  if seen <> 0 then failures := failures || 'pupil could list the other school staff'; end if;

  thread := public.start_thread(gf, 'Question about the Maths CA', gf_teacher,
                                'Good afternoon sir, please may I ask about question 2?');
  if thread is null then failures := failures || 'pupil could not start a thread with staff'; end if;

  -- Pupil to pupil, and pupil to themselves, are both refused.
  begin
    perform public.start_thread(gf, 'hello', pupil_uid, 'hi');
    failures := failures || 'pupil started a thread with themselves';
  exception when others then null; end;
  begin
    perform public.start_thread(gf, 'hello', other_pupil, 'hi');
    failures := failures || 'pupil started a thread with another pupil';
  exception when others then null; end;
  begin
    perform public.start_thread(gf, 'hello', bs_admin, 'hi');
    failures := failures || 'pupil messaged across tenants';
  exception when others then null; end;

  select id into msg from public.messages where thread_id = thread;

  begin
    update public.messages set body = 'something else entirely' where id = msg;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'a sent message was edited'; end if;
  exception when others then null; end;

  update public.messages set withdrawn_at = now() where id = msg;
  get diagnostics affected = row_count;
  if affected <> 1 then failures := failures || 'sender could not withdraw their own message'; end if;

  begin
    update public.messages set withdrawn_at = null where id = msg;
    get diagnostics affected = row_count;
    if affected > 0 then restored := true; end if;
  exception when others then null; end;
  if restored then failures := failures || 'a withdrawal was reversed'; end if;
  reset role;

  -- The recipient can read and reply.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_teacher, 'role', 'authenticated',
                      'email', 'teacher@greenfield.test')::text, true);
  set local role authenticated;
  select count(*) into seen from public.messages where thread_id = thread;
  if seen = 0 then failures := failures || 'the recipient cannot read the thread'; end if;
  perform public.post_message(thread, 'Of course. Come and see me after assembly.');
  reset role;

  -- The other school sees nothing at all.
  perform set_config('request.jwt.claims',
    json_build_object('sub', bs_admin, 'role', 'authenticated',
                      'email', 'admin@brightstar.test')::text, true);
  set local role authenticated;
  select count(*) into seen from public.message_threads;
  if seen <> 0 then failures := failures || 'another school admin read the thread list'; end if;
  select count(*) into seen from public.messages;
  if seen <> 0 then failures := failures || 'another school admin read the messages'; end if;
  reset role;

  -- This school's administrator can, deliberately.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_admin, 'role', 'authenticated',
                      'email', 'admin@greenfield.test')::text, true);
  set local role authenticated;
  select count(*) into seen from public.messages where thread_id = thread;
  if seen <> 2 then failures := failures || format('school admin sees %s of 2 messages', seen); end if;
  reset role;

  -- The other school's pupil cannot.
  perform set_config('request.jwt.claims',
    json_build_object('sub', other_pupil, 'role', 'authenticated',
                      'email', 'student@brightstar.test')::text, true);
  set local role authenticated;
  select count(*) into seen from public.messages;
  if seen <> 0 then failures := failures || 'another school pupil read the thread'; end if;
  reset role;

  if array_length(failures, 1) is null then
    raise notice 'messaging suite: all checks passed';
  else
    raise exception 'MESSAGING FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
