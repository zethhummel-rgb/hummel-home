-- Run inside a transaction with the schema in place. All synthetic rows are rolled back.
begin;
select set_config('test.push_owner',gen_random_uuid()::text,true),set_config('test.push_member',gen_random_uuid()::text,true),set_config('test.push_outsider',gen_random_uuid()::text,true),set_config('test.push_home',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('test.push_owner')::uuid,'push-owner-'||current_setting('test.push_owner')||'@qa.invalid',now()),
 (current_setting('test.push_member')::uuid,'push-member-'||current_setting('test.push_member')||'@qa.invalid',now()),
 (current_setting('test.push_outsider')::uuid,'push-outside-'||current_setting('test.push_outsider')||'@qa.invalid',now());
insert into public.households(id,name,owner_id) values(current_setting('test.push_home')::uuid,'Push QA',current_setting('test.push_owner')::uuid);
insert into public.household_members(household_id,user_id,display_name,role) values
 (current_setting('test.push_home')::uuid,current_setting('test.push_owner')::uuid,'Owner','owner'),
 (current_setting('test.push_home')::uuid,current_setting('test.push_member')::uuid,'Member','member');
do $$declare p jsonb; d uuid; result jsonb;begin
 p:=jsonb_build_object('householdId',current_setting('test.push_home'),'userId',current_setting('test.push_owner'),'endpoint','https://web.push.apple.com/qa-'||current_setting('test.push_home'),'subscription',jsonb_build_object('keys',jsonb_build_object('auth','qa','p256dh','qa')));
 perform public.push_service('subscribe',p);
 if public.push_service('status',p)->>'enabled'<>'true' then raise exception 'Subscription did not save';end if;
 if public.push_service('status',p||jsonb_build_object('userId',current_setting('test.push_member')))->>'enabled'<>'false' then raise exception 'Other member sees device';end if;
 begin perform public.push_service('subscribe',p||jsonb_build_object('userId',current_setting('test.push_outsider')));raise exception 'OUTSIDER_ACCEPTED';exception when raise_exception then if sqlerrm='OUTSIDER_ACCEPTED' then raise;end if;end;
 select id into d from private.push_devices where endpoint=p->>'endpoint';
 if public.push_service('claim',jsonb_build_object('deviceId',d,'userId',current_setting('test.push_owner'),'key','qa'))<>'true'::jsonb then raise exception 'First delivery not claimed';end if;
 if public.push_service('claim',jsonb_build_object('deviceId',d,'userId',current_setting('test.push_owner'),'key','qa'))<>'false'::jsonb then raise exception 'Duplicate delivery claimed';end if;
 perform public.push_service('finish',jsonb_build_object('deviceId',d,'key','qa','state','sent'));
 update private.push_deliveries set lease_until=now()-interval '1 minute' where device_id=d;
 if public.push_service('claim',jsonb_build_object('deviceId',d,'userId',current_setting('test.push_owner'),'key','qa'))<>'false'::jsonb then raise exception 'Sent delivery reclaimed';end if;
 -- No cross-account takeover with different encryption keys.
 begin perform public.push_service('subscribe',p||jsonb_build_object('userId',current_setting('test.push_member'),'subscription','{"keys":{"auth":"different","p256dh":"different"}}'::jsonb));raise exception 'TAKEOVER_ACCEPTED';exception when raise_exception then if sqlerrm='TAKEOVER_ACCEPTED' then raise;end if;end;
 -- A legitimate shared-browser switch invalidates a stale worker snapshot.
 perform public.push_service('subscribe',p||jsonb_build_object('userId',current_setting('test.push_member')));
 if public.push_service('claim',jsonb_build_object('deviceId',d,'userId',current_setting('test.push_owner'),'key','old-user'))<>'false'::jsonb then raise exception 'Old user delivery claimed';end if;
 delete from public.household_members where user_id=current_setting('test.push_member')::uuid;
 if public.push_service('claim',jsonb_build_object('deviceId',d,'userId',current_setting('test.push_member'),'key','removed'))<>'false'::jsonb then raise exception 'Removed member delivery claimed';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.push_owner'),true);
insert into public.household_events(household_id,title,person,starts_at,ends_at,reminder_minutes) values(current_setting('test.push_home')::uuid,'Reminder QA','Everyone',now()+interval '1 hour',now()+interval '2 hours',15);
update public.household_events set reminder_minutes=30 where household_id=current_setting('test.push_home')::uuid;
do $$begin
 if not exists(select 1 from public.household_events where household_id=current_setting('test.push_home')::uuid and reminder_minutes=30) then raise exception 'Member reminder save failed';end if;
 begin update public.household_events set reminder_minutes=10081 where household_id=current_setting('test.push_home')::uuid;raise exception 'INVALID_REMINDER';exception when check_violation then null;end;
 begin perform public.push_service('secrets','{}');raise exception 'SECRET_ACCESS';exception when insufficient_privilege then null;end;
 begin perform public.push_service('subscribe','{}');raise exception 'SPOOFED_SUBSCRIPTION';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','private.push_devices','SELECT') or has_table_privilege('anon','private.push_devices','SELECT') then raise exception 'Device keys exposed';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.push_outsider'),true);
do $$declare n integer;begin
 update public.household_events set reminder_minutes=0 where household_id=current_setting('test.push_home')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Outside reminder write';end if;
 if has_function_privilege('anon','public.push_service(text,jsonb)','EXECUTE') then raise exception 'Anonymous service access';end if;
end$$;
rollback;
select 'PASSED: private keys and subscriptions inaccessible, membership-bound subscriptions, shared-browser ownership, duplicate claims denied, sent deliveries never retried, removed members excluded, native reminder range and household RLS. Synthetic rows rolled back.' as result;
