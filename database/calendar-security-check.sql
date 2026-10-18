begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','calendar-owner@qa.invalid',now()),
 ('20000000-0000-4000-8000-000000000002','calendar-outside@qa.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('test.calendar_home',public.create_household('Calendar QA','Owner')::text,true);
insert into public.household_events(household_id,title,starts_at,ends_at) values(current_setting('test.calendar_home')::uuid,'QA event','2026-10-18T14:00Z','2026-10-18T15:00Z');
do $$begin
 if(select count(*) from public.household_events where household_id=current_setting('test.calendar_home')::uuid)<>1 then raise exception 'Owner read failed';end if;
 if has_table_privilege('anon','public.household_events','SELECT') then raise exception 'Anonymous calendar leak';end if;
 if has_function_privilege('authenticated','public.calendar_service(text,jsonb)','EXECUTE') then raise exception 'Provider token endpoint exposed';end if;
 if has_table_privilege('authenticated','private.google_calendar_connections','SELECT') then raise exception 'Provider connections exposed';end if;
end$$;
update public.household_events set title='QA edit',version=2 where household_id=current_setting('test.calendar_home')::uuid and version=1;
do $$begin if not exists(select 1 from public.household_events where title='QA edit' and version=2) then raise exception 'Edit failed';end if;end$$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.household_events where household_id=current_setting('test.calendar_home')::uuid) then raise exception 'Outsider read leak';end if;
 begin insert into public.household_events(household_id,title,starts_at,ends_at) values(current_setting('test.calendar_home')::uuid,'Denied','2026-10-18T14:00Z','2026-10-18T15:00Z');raise exception 'OUTSIDER_WRITE';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
delete from public.household_events where household_id=current_setting('test.calendar_home')::uuid and version=1;
do $$begin if not exists(select 1 from public.household_events where title='QA edit') then raise exception 'Stale delete was permitted';end if;end$$;
delete from public.household_events where household_id=current_setting('test.calendar_home')::uuid and version=2;
reset role;
select public.calendar_service('state_create',jsonb_build_object('hash','qa-state-hash','verifier','qa-verifier','userId','20000000-0000-4000-8000-000000000001','householdId',current_setting('test.calendar_home')));
do $$begin
 if public.calendar_service('state_take','{"hash":"qa-state-hash"}'::jsonb) is null then raise exception 'OAuth state not available';end if;
 if public.calendar_service('state_take','{"hash":"qa-state-hash"}'::jsonb) is not null then raise exception 'OAuth state replay allowed';end if;
end$$;
select public.calendar_service('connection_set',jsonb_build_object('householdId',current_setting('test.calendar_home'),'userId','20000000-0000-4000-8000-000000000001','calendarId','qa-calendar','refreshToken','synthetic-not-a-real-token'));
do $$begin
 if public.calendar_service('connection_get',jsonb_build_object('householdId',current_setting('test.calendar_home')))->>'refreshToken'<>'synthetic-not-a-real-token' then raise exception 'Vault round trip failed';end if;
end$$;
set local role authenticated;
do $$begin
 begin insert into public.household_events(household_id,title,starts_at,ends_at) values(current_setting('test.calendar_home')::uuid,'Blocked during import','2026-10-18T14:00Z','2026-10-18T15:00Z');raise exception 'NATIVE_WRITE_DURING_IMPORT';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'PASSED: native events CRUD, stale-write protection, outsider/anonymous isolation, provider-secret isolation, single-use OAuth state, encrypted Vault round trip, import write freeze. Synthetic records rolled back.' as result;
