-- Explicit final cutover controls; inert until a configured household is paused.
alter table private.household_transitions add column write_paused boolean not null default false;
alter table private.household_transitions add column completed_at timestamptz;
alter table private.household_transitions add column transfer_report jsonb;
create function private.household_transition_state(hid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('direction',t.direction,'active',coalesce(t.active,false),'writePaused',coalesce(t.write_paused,false),
 'completed',t.completed_at is not null,'readOnly',coalesce(t.write_paused or t.direction='source' and t.completed_at is not null,false))
 from (select 1) dummy left join private.household_transitions t on t.household_id=hid;
$$;
revoke all on function private.household_transition_state(uuid) from public,anon;
grant execute on function private.household_transition_state(uuid) to authenticated,service_role;
create function public.household_transition_state(hid uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.is_member(hid) then raise exception 'Household membership required';end if;
 return private.household_transition_state(hid);
end;$$;
revoke all on function public.household_transition_state(uuid) from public,anon;
grant execute on function public.household_transition_state(uuid) to authenticated;
create function public.household_transition_state_service(hid uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.household_transition_state(hid);$$;
revoke all on function public.household_transition_state_service(uuid) from public,anon,authenticated;
grant execute on function public.household_transition_state_service(uuid) to service_role;
create function private.guard_transition_source_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare hid uuid;
begin
 if tg_op='DELETE' then hid:=old.household_id;else hid:=new.household_id;end if;
 if exists(select 1 from private.household_transitions where household_id=hid and direction='source' and (write_paused or completed_at is not null)) then
  raise exception 'Your household is moving to HH. Open HH Family to make changes after the transfer.';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function private.guard_transition_source_write() from public,anon,authenticated;
create trigger guard_transition_source_write before insert or update or delete on public.household_items for each row execute function private.guard_transition_source_write();
create trigger guard_transition_source_write before insert or update or delete on public.household_events for each row execute function private.guard_transition_source_write();
notify pgrst,'reload schema';
