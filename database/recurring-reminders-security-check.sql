begin;
select set_config('test.reminder_owner',gen_random_uuid()::text,true),set_config('test.reminder_outsider',gen_random_uuid()::text,true),set_config('test.reminder_home',gen_random_uuid()::text,true),set_config('test.reminder_item',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('test.reminder_owner')::uuid,'reminder-'||current_setting('test.reminder_owner')||'@qa.invalid',now()),
 (current_setting('test.reminder_outsider')::uuid,'reminder-outside-'||current_setting('test.reminder_outsider')||'@qa.invalid',now());
insert into public.households(id,name,owner_id) values(current_setting('test.reminder_home')::uuid,'Reminder QA',current_setting('test.reminder_owner')::uuid);
insert into public.household_members(household_id,user_id,display_name,role) values(current_setting('test.reminder_home')::uuid,current_setting('test.reminder_owner')::uuid,'QA','owner');
do $$begin
 if private.advance_reminder('2027-01-31','month',1,'2027-01-31')<>'2027-02-28' then raise exception 'Short month clamp';end if;
 if private.advance_reminder('2027-01-31','month',1,'2027-02-28')<>'2027-03-31' then raise exception 'Month anchor drift';end if;
 if private.advance_reminder('2028-02-29','year',1,'2028-02-29')<>'2029-02-28' then raise exception 'Leap clamp';end if;
 if private.advance_reminder('2028-02-29','year',1,'2031-03-01')<>'2032-02-29' then raise exception 'Leap anchor drift';end if;
 if private.advance_reminder('2026-01-01','day',5,'2026-10-18')<>'2026-10-23' then raise exception 'Five day overdue advance';end if;
 if private.advance_reminder('2026-10-18','week',2,'2026-10-18')<>'2026-11-01' then raise exception 'Biweekly advance';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.reminder_owner'),true);
-- Regression: upgrading a pre-existing undated task must work too.
insert into public.household_items(household_id,kind,title) values(current_setting('test.reminder_home')::uuid,'task','Existing undated QA');
update public.household_items set due='2026-10-20',reminder_time='09:00',repeat_unit='month',repeat_every=1 where household_id=current_setting('test.reminder_home')::uuid and title='Existing undated QA' and reminder_version=1;
do $$begin
 if not exists(select 1 from public.household_items where household_id=current_setting('test.reminder_home')::uuid and title='Existing undated QA' and repeat_unit='month' and repeat_anchor='2026-10-20' and remind_at='2026-10-20T13:00:00Z' and reminder_version=2) then raise exception 'Existing undated reminder upgrade';end if;
end$$;
insert into public.household_items(id,household_id,kind,title,due,reminder_time,repeat_unit,repeat_every) values(current_setting('test.reminder_item')::uuid,current_setting('test.reminder_home')::uuid,'task','Flea and tick QA','2027-01-31','09:00','month',1);
do $$begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and remind_at='2027-01-31T14:00:00Z' and reminder_version=1) then raise exception 'Eastern reminder storage';end if;
end$$;
update public.household_items set done=true where id=current_setting('test.reminder_item')::uuid and reminder_version=1;
do $$declare n integer;begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and due='2027-02-28' and not done and reminder_version=2 and last_completed_at is not null and repeat_anchor='2027-01-31') then raise exception 'Repeat completion did not advance atomically';end if;
 update public.household_items set done=true where id=current_setting('test.reminder_item')::uuid and reminder_version=1;get diagnostics n=row_count;if n<>0 then raise exception 'Stale completion succeeded';end if;
 begin update public.household_items set reminder_version=99 where id=current_setting('test.reminder_item')::uuid;raise exception 'VERSION_WRITE';exception when insufficient_privilege then null;end;
 begin insert into public.household_items(household_id,kind,title,repeat_unit) values(current_setting('test.reminder_home')::uuid,'task','No date','month');raise exception 'UNDATED_REPEAT';exception when check_violation then null;end;
 begin insert into public.household_items(household_id,kind,title,reminder_time) values(current_setting('test.reminder_home')::uuid,'task','No date','09:00');raise exception 'UNDATED_NOTIFICATION';exception when check_violation then null;end;
 begin insert into public.household_items(household_id,kind,title,due,repeat_unit,repeat_every) values(current_setting('test.reminder_home')::uuid,'task','Bad interval','2027-01-01','day',0);raise exception 'BAD_INTERVAL';exception when check_violation then null;end;
end$$;
-- A second completion with even the latest version must not skip a month.
update public.household_items set done=true where id=current_setting('test.reminder_item')::uuid and reminder_version=2;
do $$begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and due='2027-02-28' and not done and reminder_version=2 and remind_at='2027-02-28T14:00:00Z') then raise exception 'Double completion skipped next occurrence';end if;
end$$;
-- Waiting reminders remain editable, including their notification and next date.
update public.household_items set title='Edited reminder',reminder_time='10:15' where id=current_setting('test.reminder_item')::uuid and reminder_version=2;
do $$begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and title='Edited reminder' and reminder_time='10:15' and due='2027-02-28' and reminder_version=3) then raise exception 'Waiting reminder edit failed';end if;
end$$;
-- A reminder that has become due can be completed again.
update public.household_items set due=(now() at time zone 'America/Toronto')::date where id=current_setting('test.reminder_item')::uuid;
update public.household_items set done=true where id=current_setting('test.reminder_item')::uuid;
do $$begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and due=private.advance_reminder((now() at time zone 'America/Toronto')::date,'month',1,(now() at time zone 'America/Toronto')::date) and not done and reminder_version=5) then raise exception 'Due repeat did not reactivate';end if;
end$$;
update public.household_items set due='2027-05-02' where id=current_setting('test.reminder_item')::uuid;
do $$begin
 if not exists(select 1 from public.household_items where id=current_setting('test.reminder_item')::uuid and repeat_anchor='2027-05-02') then raise exception 'Edited date did not reset anchor';end if;
end$$;
insert into public.household_items(household_id,kind,title) values(current_setting('test.reminder_home')::uuid,'grocery','Groceries still work');
select set_config('request.jwt.claim.sub',current_setting('test.reminder_outsider'),true);
do $$declare n integer;begin
 if exists(select 1 from public.household_items where household_id=current_setting('test.reminder_home')::uuid) then raise exception 'Outside reminder read';end if;
 update public.household_items set done=true where id=current_setting('test.reminder_item')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Outside reminder completion';end if;
 if has_table_privilege('anon','public.household_items','SELECT') then raise exception 'Anonymous reminder access';end if;
end$$;
rollback;
select 'PASSED: recurring completion, same-day double completion guard, waiting edits, due-date reactivation, stale-write protection, original month/leap anchors, overdue skips, Eastern DST, edit reset, notification constraints, grocery compatibility, version protection, household and anonymous isolation. Synthetic rows rolled back.' as result;
