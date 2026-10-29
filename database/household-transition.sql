-- Temporary, explicit household transition. Credentials stay server-side.
create table private.household_transitions(
 household_id uuid primary key references public.households(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 direction text not null check(direction in ('source','target')),
 peer_household_id uuid not null,
 peer_project text not null check(peer_project in ('ybizqfghnplcxlmlhvyn','njpdqiwrwgoothkstoql')),
 token_secret_id uuid,token_hash text not null,
 person_map jsonb not null default '{}',active boolean not null default false,
 created_at timestamptz not null default now(),
 check(direction='source' or token_secret_id is not null)
);
alter table private.household_transitions enable row level security;
revoke all on private.household_transitions from public,anon,authenticated;
create table private.household_transition_snapshots(
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id) on delete cascade,
 captured_at timestamptz not null default now(),snapshot jsonb not null,snapshot_hash text not null
);
create index household_transition_snapshots_home on private.household_transition_snapshots(household_id,captured_at);
alter table private.household_transition_snapshots enable row level security;
revoke all on private.household_transition_snapshots from public,anon,authenticated;
create function private.household_transition_active(hid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.household_transitions t join public.households h on h.id=t.household_id and h.owner_id=t.owner_id where t.household_id=hid and t.direction='target' and t.active);
$$;
revoke all on function private.household_transition_active(uuid) from public,anon;
grant execute on function private.household_transition_active(uuid) to authenticated;
create function public.household_transition_active(hid uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.is_member(hid) then raise exception 'Household membership required';end if;
 return private.household_transition_active(hid);
end;$$;
revoke all on function public.household_transition_active(uuid) from public,anon;
grant execute on function public.household_transition_active(uuid) to authenticated;
create function private.household_transition_service(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.household_transitions%rowtype;secret text;
begin
 select c.* into t from private.household_transitions c join public.households h on h.id=c.household_id and h.owner_id=c.owner_id
 join public.household_members m on m.household_id=h.id and m.user_id=h.owner_id and m.role='owner'
 where c.household_id=(payload->>'householdId')::uuid and (c.active or action='snapshot' or (action='config' and payload->>'includeInactive'='true'));
 if not found then return null;end if;
 if action='authorize' then
  if not t.active or t.direction<>'source' or payload->>'tokenHash' is distinct from t.token_hash then return null;end if;
  return jsonb_build_object('householdId',t.household_id,'ownerId',t.owner_id);
 elsif action='config' then
  if t.direction<>'target' then return null;end if;
  select decrypted_secret into secret from vault.decrypted_secrets where id=t.token_secret_id;
  if secret is null then raise exception 'Transition credential unavailable';end if;
  return jsonb_build_object('householdId',t.household_id,'peerHouseholdId',t.peer_household_id,'peerProject',t.peer_project,'token',secret,'personMap',t.person_map);
 elsif action='snapshot' then
  if t.direction<>'target' or jsonb_typeof(payload->'snapshot') is distinct from 'object' or octet_length((payload->'snapshot')::text)>8000000 then raise exception 'Invalid snapshot';end if;
  insert into private.household_transition_snapshots(household_id,snapshot,snapshot_hash) values(t.household_id,payload->'snapshot',encode(sha256(convert_to((payload->'snapshot')::text,'UTF8')),'hex'));
  return jsonb_build_object('saved',true);
 else raise exception 'Unknown transition operation';end if;
end;$$;
revoke all on function private.household_transition_service(text,jsonb) from public,anon,authenticated;
grant execute on function private.household_transition_service(text,jsonb) to service_role;
create function public.household_transition_service(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.household_transition_service(action,payload);$$;
revoke all on function public.household_transition_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.household_transition_service(text,jsonb) to service_role;
notify pgrst,'reload schema';
