create table crypto_holdings (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol         text not null,
  name           text not null,
  quantity       numeric(28,10) not null,
  average_price  numeric(19,6) not null default 0,
  current_price  numeric(19,6) not null default 0,
  previous_close numeric(19,6),
  currency       char(3) not null default 'EUR',
  updated_at     timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table crypto_holdings enable row level security;
create index crypto_holdings_user_idx on crypto_holdings (user_id);

create policy crypto_holdings_select on crypto_holdings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy crypto_holdings_insert on crypto_holdings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy crypto_holdings_update on crypto_holdings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy crypto_holdings_delete on crypto_holdings for delete to authenticated
  using ((select auth.uid()) = user_id);
