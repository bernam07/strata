alter table instruments add column if not exists yahoo_symbol text;

create table watchlist (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol     text not null,
  name       text not null,
  currency   char(3) not null default 'USD',
  added_at   timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table watchlist enable row level security;

create policy watchlist_select on watchlist for select to authenticated
  using ((select auth.uid()) = user_id);
create policy watchlist_insert on watchlist for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy watchlist_delete on watchlist for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_broker_total(p_user uuid, p_total numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.broker_accounts
    set total = p_total, updated_at = now()
    where user_id = p_user and provider = 't212';
end;
$$;

revoke execute on function public.set_broker_total(uuid, numeric) from public;
revoke execute on function public.set_broker_total(uuid, numeric) from authenticated;
grant execute on function public.set_broker_total(uuid, numeric) to service_role;

create function public.set_instrument_yahoo(p_id uuid, p_symbol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.instruments set yahoo_symbol = p_symbol where id = p_id;
end;
$$;

revoke execute on function public.set_instrument_yahoo(uuid, text) from public;
revoke execute on function public.set_instrument_yahoo(uuid, text) from authenticated;
grant execute on function public.set_instrument_yahoo(uuid, text) to service_role;
