-- Migration 0035: Preserve previous_close in replace_holdings and ensure safe upsert behavior

create or replace function public.replace_holdings(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- 1. Remove any holdings that are no longer present in p_rows for this user
  delete from public.holdings h
  where h.user_id = p_user
    and not exists (
      select 1
      from jsonb_to_recordset(p_rows) as x(instrument_id uuid)
      where x.instrument_id = h.instrument_id
    );

  -- 2. Upsert the provided holdings, preserving existing previous_close if excluded is null
  insert into public.holdings (
    user_id,
    instrument_id,
    quantity,
    average_price,
    current_price,
    currency,
    previous_close,
    updated_at
  )
  select
    p_user,
    x.instrument_id,
    x.quantity,
    x.average_price,
    x.current_price,
    coalesce(x.currency, 'EUR'),
    x.previous_close,
    now()
  from jsonb_to_recordset(p_rows) as x(
    instrument_id  uuid,
    quantity       numeric,
    average_price  numeric,
    current_price  numeric,
    currency       char(3),
    previous_close numeric
  )
  on conflict (user_id, instrument_id) do update set
    quantity       = excluded.quantity,
    average_price  = excluded.average_price,
    current_price  = excluded.current_price,
    currency       = excluded.currency,
    previous_close = coalesce(excluded.previous_close, public.holdings.previous_close),
    updated_at     = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_holdings(uuid, jsonb) from public;
revoke execute on function public.replace_holdings(uuid, jsonb) from authenticated;
grant execute on function public.replace_holdings(uuid, jsonb) to service_role;
