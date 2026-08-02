create table holdings (
  user_id       uuid not null default auth.uid(),
  instrument_id uuid not null,
  quantity      numeric(24,8) not null,
  average_price numeric(19,6) not null,
  current_price numeric(19,6) not null,
  currency      char(3) not null default 'EUR',
  updated_at    timestamptz not null default now(),
  primary key (user_id, instrument_id),
  foreign key (instrument_id, user_id)
    references instruments (id, user_id) on delete cascade
);

alter table holdings enable row level security;

create policy holdings_select on holdings for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.replace_holdings(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.holdings where user_id = p_user;

  insert into public.holdings (
    user_id, instrument_id, quantity, average_price, current_price, currency
  )
  select
    p_user, instrument_id, quantity, average_price, current_price,
    coalesce(currency, 'EUR')
  from jsonb_to_recordset(p_rows) as x(
    user_id       uuid,
    instrument_id uuid,
    quantity      numeric,
    average_price numeric,
    current_price numeric,
    currency      char(3)
  );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_holdings(uuid, jsonb) from public;
revoke execute on function public.replace_holdings(uuid, jsonb) from authenticated;
grant execute on function public.replace_holdings(uuid, jsonb) to service_role;
