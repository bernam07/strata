create table price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol       text not null,
  name         text not null,
  direction    text not null check (direction in ('above', 'below')),
  target       numeric(19,6) not null,
  currency     char(3) not null default 'USD',
  triggered_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table price_alerts enable row level security;
create index price_alerts_user_idx on price_alerts (user_id);

create policy price_alerts_select on price_alerts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy price_alerts_insert on price_alerts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy price_alerts_update on price_alerts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy price_alerts_delete on price_alerts for delete to authenticated
  using ((select auth.uid()) = user_id);
