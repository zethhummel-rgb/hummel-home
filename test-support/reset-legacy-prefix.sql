-- ONE-TIME destructive reset. Authorized by Zeth on 2026-11-05.
-- ONLY ybizqfghnplcxlmlhvyn. Never apply to HH Family or use as a future migration.
begin;
do $guard$ begin
 if to_regclass('private.pilot_hosts') is not null then raise exception 'Refusing reset: this is already an HH-schema project';end if;
 if (select count(*) from public.households)<>1 or not exists(select 1 from public.households where id='df5f4d6a-a09d-4303-8912-24769cd0700d') then raise exception 'Legacy TEST household identity changed';end if;
 if not exists(select 1 from auth.users where lower(email)='zethhummel@gmail.com' and email_confirmed_at is not null) then raise exception 'Test owner login missing';end if;
end;$guard$;
-- Stop scheduled outbound calls and erase only credentials belonging to old app connections.
select cron.unschedule(jobid) from cron.job where jobname='hummel-event-reminders';
delete from vault.secrets where id in (select secret_id from private.google_calendar_connections union select key_secret_id from private.push_settings union select token_secret_id from private.household_transitions where token_secret_id is not null) or name in ('hummel_push_cron','home_together_api_url');
delete from auth.sessions;
drop schema private cascade;
drop schema public cascade;
create schema public authorization postgres;
grant usage on schema public to anon,authenticated,service_role;
-- Append the checked-in fresh bootstrap without its outer BEGIN/COMMIT,
-- then seed-household.sql and reset-legacy-suffix.sql, in this SAME transaction.
