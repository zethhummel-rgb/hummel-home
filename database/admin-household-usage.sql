-- This endpoint only reads timestamps and cannot modify the household list.
create function private.admin_household_usage()
returns table(household_id uuid,last_used_at timestamptz,last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(
  select 1 from auth.users u join private.pilot_hosts p on p.email=lower(u.email)
  where u.id=auth.uid() and lower(u.email)='hummelhomeapp@gmail.com' and u.email_confirmed_at is not null
 ) then raise exception 'Admin access required' using errcode='42501'; end if;
 return query
  select h.id,usage.last_used_at,max(u.last_sign_in_at)
  from public.households h
  left join private.household_last_use usage on usage.household_id=h.id
  left join public.household_members m on m.household_id=h.id
  left join auth.users u on u.id=m.user_id
  group by h.id,usage.last_used_at;
end;$$;
revoke all on function private.admin_household_usage() from public,anon,authenticated;
grant execute on function private.admin_household_usage() to authenticated;

create function public.admin_household_usage()
returns table(household_id uuid,last_used_at timestamptz,last_sign_in_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from private.admin_household_usage();$$;
revoke all on function public.admin_household_usage() from public,anon,authenticated;
grant execute on function public.admin_household_usage() to authenticated;
