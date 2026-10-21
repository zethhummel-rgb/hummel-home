-- Keep the default alert independent of the optional additional reminder.
alter table public.household_events add column reminder_30_enabled boolean not null default true;
grant update(reminder_30_enabled) on public.household_events to authenticated;
