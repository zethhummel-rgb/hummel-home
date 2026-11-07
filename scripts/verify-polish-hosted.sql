-- TEST ONLY. Execute as one transaction against the fictional Maple household.
-- Every fixture and profile change rolls back; no messages are sent.
begin;
select set_config('hh.polish.home',(select id::text from public.households where name='Maple House - TEST'),true);
select set_config('hh.polish.user',(select user_id::text from public.household_members where household_id=current_setting('hh.polish.home')::uuid order by role desc limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('hh.polish.user'),true);
set local role authenticated;
do $$
declare
 hid uuid:=current_setting('hh.polish.home')::uuid; uid uuid:=auth.uid(); old_name text;
 qa_name text:='Polish Verification '||left(gen_random_uuid()::text,8);
 task_id uuid:=gen_random_uuid(); event_id uuid:=gen_random_uuid();
 p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); ing1 uuid:=gen_random_uuid(); ing2 uuid:=gen_random_uuid();
 ingredient_title text:='Polish ingredient '||gen_random_uuid()::text; selected jsonb; result jsonb;
begin
 if hid is null or uid is null then raise exception 'TEST fixture unavailable';end if;
 select display_name into old_name from public.household_members where household_id=hid and user_id=uid;
 insert into public.household_items(id,household_id,kind,title,person) values(task_id,hid,'task','Polish rollback task',old_name);
 insert into public.household_events(id,household_id,title,person,starts_at,ends_at) values(event_id,hid,'Polish rollback event',old_name,now()+interval '30 days',now()+interval '30 days 1 hour');
 update public.household_members set display_name=qa_name where household_id=hid and user_id=uid;
 if (select person from public.household_items where id=task_id)<>qa_name or (select person from public.household_events where id=event_id)<>qa_name then raise exception 'Assignment preservation failed';end if;
 if (select person_ids from public.household_events where id=event_id)<>array[uid::text] then raise exception 'Stable event assignment missing';end if;
 insert into public.household_meal_plans(id,household_id,title,meal_date,ingredients) values
 (p1,hid,'Polish rollback meal A',current_date,jsonb_build_array(jsonb_build_object('id',ing1,'title',ingredient_title,'category','Produce','quantity',2,'unit','kg'))),
 (p2,hid,'Polish rollback meal B',current_date,jsonb_build_array(jsonb_build_object('id',ing2,'title',ingredient_title,'category','Produce','quantity',2,'unit','kg')));
 selected:=jsonb_build_array(jsonb_build_object('meal_id',p1,'version',1,'ingredient_ids',jsonb_build_array(ing1)),jsonb_build_object('meal_id',p2,'version',1,'ingredient_ids',jsonb_build_array(ing2)));
 result:=public.add_meal_ingredients(hid,selected);
 if result<>jsonb_build_object('added',1,'skipped',0) then raise exception 'Combined insert failed: %',result;end if;
 if (select grocery_quantity from public.household_items where household_id=hid and kind='grocery' and title=ingredient_title)<>4 then raise exception 'Wrong combined total';end if;
 result:=public.add_meal_ingredients(hid,selected);
 if result<>jsonb_build_object('added',0,'skipped',1) then raise exception 'Retry duplicated ingredient: %',result;end if;
end $$;
rollback;
select 'Hosted TEST checks passed; name, assignments, ingredients and all fixtures rolled back' as result;
