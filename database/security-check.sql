-- Transaction-only synthetic users and records. Everything is rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','owner@hummel-qa.invalid',now(),'{}'),
 ('10000000-0000-4000-8000-000000000002','member@hummel-qa.invalid',now(),'{}'),
 ('10000000-0000-4000-8000-000000000003','outsider@hummel-qa.invalid',now(),'{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('test.home',public.create_household('Test home','Owner')::text,true);
select set_config('test.invite',public.create_household_invite('member@hummel-qa.invalid'),true);
insert into public.household_items(household_id,kind,title) values(current_setting('test.home')::uuid,'grocery','Synthetic groceries');
do $$begin
 if(select count(*) from public.household_items)<>1 then raise exception 'Owner cannot read own item'; end if;
 if has_table_privilege('anon','public.household_items','SELECT') then raise exception 'Anonymous table access exists'; end if;
 if has_function_privilege('anon','public.create_household(text,text)','EXECUTE') then raise exception 'Anonymous onboarding access exists'; end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$begin
 if(select count(*) from public.household_items)<>0 then raise exception 'Outsider sees another household'; end if;
 if(select count(*) from public.household_invites)<>0 then raise exception 'Outsider sees invitations'; end if;
 begin
  perform public.accept_household_invite(current_setting('test.invite'),'Outsider');
  raise exception 'WRONG_EMAIL_ACCEPTED';
 exception when others then if sqlerrm='WRONG_EMAIL_ACCEPTED' then raise; end if; end;
 begin
  insert into public.household_items(household_id,kind,title) values(current_setting('test.home')::uuid,'task','Denied');
  raise exception 'OUTSIDER_WRITE_ACCEPTED';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.accept_household_invite(current_setting('test.invite'),'Member');
do $$begin
 if(select count(*) from public.household_items)<>1 then raise exception 'Joined member cannot read'; end if;
 if(select count(*) from public.household_members)<>2 then raise exception 'Joined member cannot see family'; end if;
 if(select count(*) from public.household_invites)<>0 then raise exception 'Member sees private invitation records'; end if;
 begin
  perform public.create_household_invite('extra@hummel-qa.invalid');
  raise exception 'MEMBER_INVITE_ACCEPTED';
 exception when others then if sqlerrm='MEMBER_INVITE_ACCEPTED' then raise; end if; end;
end$$;
update public.household_items set done=true;
do $$begin if not(select bool_and(done) from public.household_items) then raise exception 'Member cannot complete item';end if;end$$;
update public.households set calendar_id='forbidden';
do $$begin if exists(select 1 from public.households where calendar_id='forbidden') then raise exception 'Member changed owner settings';end if;end$$;
reset role;
do $$begin if not exists(select 1 from public.household_invites where used_at is not null) then raise exception 'Invitation was not consumed';end if;end$$;
rollback;
select 'PASSED: household isolation, owner/member reads, shared completion, email-bound invite, single-use consumption, owner-only invites/settings, anonymous denial. Synthetic data rolled back.' as result;
