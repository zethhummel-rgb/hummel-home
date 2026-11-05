-- Fictional fixtures only. Run with the reset after checking the exact TEST project.
-- Existing authentication is retained; only Zeth's old-app login joins the test home.
do $seed$
declare owner_uid uuid; hid uuid; riley uuid; casey uuid; jamie uuid; d date:=(now() at time zone 'America/Toronto')::date; n integer; recipe record; eid uuid;
begin
 select id into strict owner_uid from auth.users where lower(email)='zethhummel@gmail.com' and email_confirmed_at is not null;
 if exists(select 1 from public.households) then raise exception 'Seed requires an empty TEST app';end if;
 insert into public.households(name,owner_id) values('Maple House - TEST',owner_uid) returning id into hid;
 insert into public.household_members(household_id,user_id,display_name,role,calendar_color) values(hid,owner_uid,'Alex Morgan','owner','#39705B');
 insert into private.pilot_hosts(email) values('zethhummel@gmail.com');
 insert into public.household_people(household_id,display_name,calendar_color) values(hid,'Jamie Morgan','#C67846') returning id into jamie;
 insert into public.household_people(household_id,display_name,calendar_color) values(hid,'Riley Morgan','#6477BA') returning id into riley;
 insert into public.household_people(household_id,display_name,calendar_color) values(hid,'Casey Morgan','#AC6291') returning id into casey;
 insert into public.household_items(household_id,kind,title,category,grocery_quantity,grocery_unit,grocery_store,done)
 select hid,'grocery',title,category,qty,unit,store,picked from (values
 ('Apples','Produce',6::numeric,null::text,'Costco',false),('Carrots','Produce',2,'kg','Costco',false),
 ('Milk','Dairy & eggs',2,'L','FreshCo',false),('Eggs','Dairy & eggs',12,null,'FreshCo',false),
 ('Turkey slices','Deli',0.25,'kg','Costco',false),('Chicken thighs','Meat & fish',1.5,'kg','Costco',false),
 ('Whole-grain bread','Bakery',1,'loaf','FreshCo',false),('Rice','Pantry',1,'kg','Costco',false),
 ('Frozen peas','Frozen',0.75,'kg','FreshCo',false),('Dish soap','Household',1,'bottle',null,false),
 ('Party supplies','Other',null,null,null,false),('Bananas','Produce',5,null,'costco',false),
 ('Yogurt','Dairy & eggs',4,'cups','FreshCo',true),('Pasta','Pantry',0.5,'kg','Costco',true),
 ('Olive oil','Pantry',0.5,'L',null,false),('Coffee','Pantry',null,null,'Corner Market',false)
 ) g(title,category,qty,unit,store,picked);
 insert into public.household_grocery_staples(household_id,title,category)
 select hid,title,category from (values('Apples','Produce'),('Milk','Dairy & eggs'),('Eggs','Dairy & eggs'),('Bread','Bakery'),('Rice','Pantry'),('Dish soap','Household')) s(title,category);
 insert into public.household_items(household_id,kind,title,person,due,reminder_time,repeat_unit,repeat_every,done)
 select hid,'task',title,person,due,at_time,unit,every,done from (values
 ('Return library books','Everyone',d-2,'16:00'::time,'none',1,false),
 ('Pack sports bag','Everyone',d,'17:00'::time,'none',1,false),
 ('Water plants','Everyone',d,'09:00'::time,'week',1,false),
 ('Read for 20 minutes','Everyone',d,'19:00'::time,'day',1,false),
 ('Put out recycling','Everyone',d+2,'19:00'::time,'week',2,false),
 ('Replace furnace filter','Everyone',(date_trunc('month',d)+interval '1 month - 1 day')::date,'10:00'::time,'month',1,false),
 ('Plan summer trip','Everyone',null::date,null::time,'none',1,false),
 ('Book annual checkup','Everyone',d+14,'09:00'::time,'year',1,false),
 ('Tidy entryway','Everyone',d-1,null::time,'none',1,true),
 ('Pick up craft supplies','Everyone',d+3,null::time,'none',1,false)
 ) t(title,person,due,at_time,unit,every,done);
 for n in 0..6 loop
  insert into public.household_events(household_id,title,description,location,starts_at,ends_at,person_ids,reminder_minutes,reminder_30_enabled)
  values(hid,(array['Family walk','Library visit','Soccer practice','School project','Swimming lesson','Pizza with friends','Board-game evening'])[n+1],
   'Fictional test event. Safe to edit or delete.','Maple neighbourhood',((d+n)+time '17:00') at time zone 'America/Toronto',((d+n)+time '18:00') at time zone 'America/Toronto',
   case when n%2=0 then array[riley::text] else array[casey::text,jamie::text] end,case when n%2=0 then 60 else null end,n<>3);
 end loop;
 insert into public.household_events(household_id,title,starts_at,ends_at,all_day,start_date,end_date,countdown_enabled)
 values(hid,'Casey birthday - TEST',(d+5)::timestamp at time zone 'America/Toronto',(d+6)::timestamp at time zone 'America/Toronto',true,d+5,d+6,true),
 (hid,'Weekend camping - TEST',(d+8)::timestamp at time zone 'America/Toronto',(d+11)::timestamp at time zone 'America/Toronto',true,d+8,d+11,true);
 insert into public.household_events(household_id,title,starts_at,ends_at,recurrence,person_ids,exceptions)
 values(hid,'Weekly family planning',((d+1)+time '18:30') at time zone 'America/Toronto',((d+1)+time '19:00') at time zone 'America/Toronto',
 array['RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=8'],array[jamie::text],jsonb_build_object((d+15)::text,null)),
 (hid,'Monthly budget check',((d+3)+time '20:00') at time zone 'America/Toronto',((d+3)+time '20:30') at time zone 'America/Toronto',array['RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=6'],'{}','{}');
 insert into public.household_events(household_id,title,starts_at,ends_at)
 values(hid,'Past appointment - TEST',((d-3)+time '10:00') at time zone 'America/Toronto',((d-3)+time '10:30') at time zone 'America/Toronto');
 insert into public.household_meal_recipes(household_id,title,instructions,ingredients)
 select hid,title,'Fictional recipe for testing. Edit ingredients, quantities and notes.',jsonb_build_array(
 jsonb_build_object('id',gen_random_uuid(),'title',ingredient,'category',category,'quantity',amount,'unit',unit),
 jsonb_build_object('id',gen_random_uuid(),'title','Carrots','category','Produce','quantity',2,'unit','kg'))
 from (values('Overnight oats','Oats','Pantry',0.5::numeric,'cups'),('Chicken wraps','Chicken','Meat & fish',0.75,'kg'),
 ('Vegetable pasta','Pasta','Pantry',0.5,'kg'),('Fruit and yogurt','Yogurt','Dairy & eggs',0.25,'L')) r(title,ingredient,category,amount,unit);
 for n in 0..6 loop
  for recipe in select *,row_number() over(order by title) as rn from public.household_meal_recipes where household_id=hid loop
   insert into public.household_meal_plans(household_id,meal_date,meal_type,title,instructions,ingredients)
   values(hid,d+n,case recipe.title when 'Overnight oats' then 'breakfast' when 'Chicken wraps' then 'lunch' when 'Vegetable pasta' then 'supper' else 'snacks' end,recipe.title,recipe.instructions,recipe.ingredients);
  end loop;
 end loop;
 insert into public.household_meal_plans(household_id,meal_date,meal_type,title) values(hid,d,'snacks','Apple slices - title only');
 insert into public.household_notes(household_id,title,body,pinned) values
 (hid,'Start here - test checklist','This is Maple House, a fictional home. Try calendar edits, grocery grouping, recurring tasks, meal shopping and pinned notes. All records can be changed. External email, Google and push delivery are disabled.',true),
 (hid,'Camping packing list',E'Tent\nSleeping bags\nFlashlights\nWater bottles\nBoard games',true),
 (hid,'Weekly family plan',E'Monday: library\nTuesday: sports\nFriday: movie night',false),
 (hid,'Notes search example','Search for pineapple to find this note. Open it on two screens to test conflicting edits.',false);
 insert into public.household_invites(household_id,email,token_hash,expires_at)
 values(hid,'new-member@example.invalid',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),now()+interval '7 days'),
 (hid,'expired-member@example.invalid',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),now()-interval '1 day');
 select id into eid from public.household_notes where household_id=hid and title='Camping packing list';
 insert into public.household_activity(household_id,recipient_id,actor_id,actor_name,entity_kind,entity_id,action,title)
 values(hid,owner_uid,null,'Jamie Morgan','note',eid,'added','Camping packing list');
end;$seed$;
