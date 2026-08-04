alter table holdings add column if not exists previous_close numeric(19,6);

create table net_worth_snapshots (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  as_of       date not null,
  net         numeric(19,4) not null,
  assets      numeric(19,4) not null,
  liabilities numeric(19,4) not null,
  investments numeric(19,4) not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, as_of)
);

alter table net_worth_snapshots enable row level security;
create index net_worth_snapshots_user_idx on net_worth_snapshots (user_id, as_of);

create policy net_worth_snapshots_select on net_worth_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);
create policy net_worth_snapshots_insert on net_worth_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy net_worth_snapshots_update on net_worth_snapshots for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
