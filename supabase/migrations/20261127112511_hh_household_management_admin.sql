-- Use the existing dashboard allowlist and authenticator policy for the household tools.
do $gates$
declare
 management text := replace(pg_get_functiondef('private.admin_households(text,jsonb)'::regprocedure),chr(13),'');
 usage text := replace(pg_get_functiondef('private.admin_household_usage()'::regprocedure),chr(13),'');
 old_actor constant text := $old$(payload->>'actorId')::uuid$old$;
 old_manage_gate constant text := $old$not exists(select 1 from auth.users u join private.pilot_hosts h on h.email=lower(u.email) where u.id=uid and lower(u.email)='hummelhomeapp@gmail.com' and u.email_confirmed_at is not null)$old$;
 old_usage_gate constant text := $old$not exists(
  select 1 from auth.users u join private.pilot_hosts p on p.email=lower(u.email)
  where u.id=auth.uid() and lower(u.email)='hummelhomeapp@gmail.com' and u.email_confirmed_at is not null
 )$old$;
 old_protection constant text := 'h.owner_id=uid or coalesce(members.is_admin_member,false)';
 protection constant text := $new$h.owner_id=uid or coalesce(members.is_admin_member,false) or exists(
    select 1 from auth.users u join private.pilot_hosts p on p.email=lower(u.email)
    where u.id=h.owner_id or exists(
     select 1 from public.household_members m where m.household_id=h.id and m.user_id=u.id
    )
   )$new$;
begin
 if strpos(management,old_actor)=0 or strpos(management,old_manage_gate)=0
  or strpos(management,old_protection)=0 or strpos(usage,old_usage_gate)=0 then
  raise exception 'Existing HH household administration checks did not match';
 end if;
 management:=replace(management,old_actor,'auth.uid()');
 management:=replace(management,old_manage_gate,'private.hh_site_admin_issuer(uid) is null or private.hh_admin_needs_second_factor()');
 management:=replace(management,$old$raise exception 'Admin access required';$old$,
  $new$raise exception 'Admin access required' using errcode='42501';$new$);
 execute replace(management,old_protection,protection);
 execute replace(usage,old_usage_gate,'private.hh_site_admin_issuer(auth.uid()) is null or private.hh_admin_needs_second_factor()');
end;
$gates$;

revoke execute on function private.admin_households(text,jsonb),public.admin_households(text,jsonb) from service_role;
grant execute on function private.admin_households(text,jsonb),public.admin_households(text,jsonb) to authenticated;
