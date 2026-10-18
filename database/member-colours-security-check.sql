begin;
select set_config('test.colour_owner',gen_random_uuid()::text,true),set_config('test.colour_member',gen_random_uuid()::text,true),set_config('test.colour_outsider',gen_random_uuid()::text,true),set_config('test.colour_home',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('test.colour_owner')::uuid,'colour-owner-'||current_setting('test.colour_owner')||'@qa.invalid',now()),
 (current_setting('test.colour_member')::uuid,'colour-member-'||current_setting('test.colour_member')||'@qa.invalid',now()),
 (current_setting('test.colour_outsider')::uuid,'colour-outside-'||current_setting('test.colour_outsider')||'@qa.invalid',now());
insert into public.households(id,name,owner_id) values(current_setting('test.colour_home')::uuid,'Colours QA',current_setting('test.colour_owner')::uuid);
insert into public.household_members(household_id,user_id,display_name,role) values
 (current_setting('test.colour_home')::uuid,current_setting('test.colour_owner')::uuid,'Owner','owner'),
 (current_setting('test.colour_home')::uuid,current_setting('test.colour_member')::uuid,'Member','member');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.colour_owner'),true);
update public.household_members set calendar_color='#C46B8C' where user_id=current_setting('test.colour_owner')::uuid;
do $$declare n integer;begin
 if not exists(select 1 from public.household_members where user_id=auth.uid() and calendar_color='#C46B8C') then raise exception 'Own colour did not save';end if;
 update public.household_members set calendar_color='#E78725' where user_id=current_setting('test.colour_member')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Owner changed another member colour';end if;
 begin update public.household_members set role='owner' where user_id=auth.uid();raise exception 'ROLE_WRITE';exception when insufficient_privilege then null;end;
 begin update public.household_members set display_name='Changed' where user_id=auth.uid();raise exception 'NAME_WRITE';exception when insufficient_privilege then null;end;
 begin update public.household_members set calendar_color='red;display:none' where user_id=auth.uid();raise exception 'INVALID_COLOR';exception when check_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.colour_member'),true);
update public.household_members set calendar_color='#467EB6' where user_id=auth.uid();
do $$begin
 if not exists(select 1 from public.household_members where user_id=auth.uid() and calendar_color='#467EB6') then raise exception 'Member own colour did not save';end if;
 if not exists(select 1 from public.household_members where user_id=current_setting('test.colour_owner')::uuid and calendar_color='#C46B8C') then raise exception 'Family cannot read shared colour';end if;
end$$;
insert into public.household_events(household_id,title,person,person_ids,starts_at,ends_at) values(current_setting('test.colour_home')::uuid,'Multi-person QA','Owner, Member',array[current_setting('test.colour_owner'),current_setting('test.colour_member')],'2026-10-18T14:00Z','2026-10-18T15:00Z');
do $$begin
 if not exists(select 1 from public.household_events where household_id=current_setting('test.colour_home')::uuid and cardinality(person_ids)=2) then raise exception 'Multi-person tags did not save';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.colour_outsider'),true);
do $$declare n integer;begin
 if exists(select 1 from public.household_members where household_id=current_setting('test.colour_home')::uuid) then raise exception 'Outside colour read';end if;
 update public.household_members set calendar_color='#123456' where user_id=current_setting('test.colour_owner')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Outside colour write';end if;
 if exists(select 1 from public.household_events where household_id=current_setting('test.colour_home')::uuid) then raise exception 'Outside tagged-event read';end if;
 if has_column_privilege('anon','public.household_members','calendar_color','UPDATE') then raise exception 'Anonymous colour writes';end if;
end$$;
rollback;
select 'PASSED: own colour updates, family colour reads, owner cannot edit other colours, role/name escalation denied, invalid CSS rejected, multi-person tags saved, outsider and anonymous isolation. Synthetic rows rolled back.' as result;
