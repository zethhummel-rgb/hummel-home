-- Test app has no background outbound jobs. Re-enable only for an approved delivery test.
select cron.unschedule(jobid) from cron.job where jobname in ('hummel-event-reminders','hh-google-calendar-copy','hh-expire-google-imports');
grant usage on schema private to service_role;
grant all on all tables in schema public,private to service_role;
grant all on all sequences in schema public,private to service_role;
notify pgrst,'reload schema';
commit;
