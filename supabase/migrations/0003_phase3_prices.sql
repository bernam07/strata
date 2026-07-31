create table prices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  instrument_id uuid not null,
  as_of         date not null,
  close         numeric(19,6) not null,
  currency      char(3) not null default 'EUR',
  created_at    timestamptz not null default now(),
  foreign key (instrument_id, user_id)
    references instruments (id, user_id) on delete cascade,
  unique (user_id, instrument_id, as_of)
);

alter table prices enable row level security;
create index prices_instrument_idx on prices (user_id, instrument_id, as_of desc);

create policy prices_select on prices for select to authenticated
  using ((select auth.uid()) = user_id);

create table fx_rates (
  base       char(3) not null,
  quote      char(3) not null,
  as_of      date not null,
  rate       numeric(19,8) not null,
  created_at timestamptz not null default now(),
  primary key (base, quote, as_of)
);

alter table fx_rates enable row level security;
create index fx_rates_lookup_idx on fx_rates (base, quote, as_of desc);

create policy fx_rates_read on fx_rates for select to authenticated
  using (true);

create function public.upsert_prices(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      user_id       uuid,
      instrument_id uuid,
      as_of         date,
      close         numeric,
      currency      char(3)
    )
  ),
  affected as (
    insert into public.prices (user_id, instrument_id, as_of, close, currency)
    select user_id, instrument_id, as_of, close, coalesce(currency, 'EUR')
    from incoming
    on conflict (user_id, instrument_id, as_of)
      do update set close = excluded.close, currency = excluded.currency
    returning 1
  )
  select count(*) into v_count from affected;
  return v_count;
end;
$$;

revoke execute on function public.upsert_prices(jsonb) from public;
revoke execute on function public.upsert_prices(jsonb) from authenticated;
grant execute on function public.upsert_prices(jsonb) to service_role;

create function public.upsert_fx_rates(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      base  char(3),
      quote char(3),
      as_of date,
      rate  numeric
    )
  ),
  affected as (
    insert into public.fx_rates (base, quote, as_of, rate)
    select base, quote, as_of, rate from incoming
    on conflict (base, quote, as_of) do update set rate = excluded.rate
    returning 1
  )
  select count(*) into v_count from affected;
  return v_count;
end;
$$;

revoke execute on function public.upsert_fx_rates(jsonb) from public;
revoke execute on function public.upsert_fx_rates(jsonb) from authenticated;
grant execute on function public.upsert_fx_rates(jsonb) to service_role;
