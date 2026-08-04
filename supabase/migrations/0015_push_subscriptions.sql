create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
create index push_subscriptions_user_idx on push_subscriptions (user_id);

create policy push_subscriptions_select on push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_subscriptions_insert on push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy push_subscriptions_update on push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy push_subscriptions_delete on push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);
