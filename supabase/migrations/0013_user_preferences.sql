create table user_preferences (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  net_worth_goal numeric(19,4),
  updated_at     timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy user_preferences_select on user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_preferences_insert on user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_preferences_update on user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
