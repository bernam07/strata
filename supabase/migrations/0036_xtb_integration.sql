-- Migration 0036: XTB institution, multi-broker holdings provider column, and RLS policies for CSV/manual holdings

insert into public.institutions (id, display_name, brand_color, logo_path, sort_order)
values ('xtb', 'XTB', '#E30613', '/institutions/xtb.svg', 15)
on conflict (id) do update set
  display_name = excluded.display_name,
  brand_color  = excluded.brand_color,
  logo_path    = excluded.logo_path,
  sort_order   = excluded.sort_order;

alter table public.holdings
  add column if not exists provider text not null default 't212';

alter table public.holdings
  drop constraint if exists holdings_pkey;

alter table public.holdings
  add primary key (user_id, instrument_id, provider);

drop policy if exists instruments_insert on public.instruments;
create policy instruments_insert on public.instruments for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists instruments_update on public.instruments;
create policy instruments_update on public.instruments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists holdings_insert on public.holdings;
create policy holdings_insert on public.holdings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists holdings_update on public.holdings;
create policy holdings_update on public.holdings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists holdings_delete on public.holdings;
create policy holdings_delete on public.holdings for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists broker_accounts_insert on public.broker_accounts;
create policy broker_accounts_insert on public.broker_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists broker_accounts_update on public.broker_accounts;
create policy broker_accounts_update on public.broker_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists broker_accounts_delete on public.broker_accounts;
create policy broker_accounts_delete on public.broker_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists transactions_update_manual on public.transactions;
create policy transactions_update_manual on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id and source in ('manual', 'csv_import'))
  with check ((select auth.uid()) = user_id and source in ('manual', 'csv_import'));

drop policy if exists transactions_delete_manual on public.transactions;
create policy transactions_delete_manual on public.transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id and source in ('manual', 'csv_import'));

create or replace function public.replace_holdings(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.holdings h
  where h.user_id = p_user
    and h.provider = 't212'
    and not exists (
      select 1
      from jsonb_to_recordset(p_rows) as x(instrument_id uuid)
      where x.instrument_id = h.instrument_id
    );

  insert into public.holdings (
    user_id,
    instrument_id,
    provider,
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
    coalesce(x.provider, 't212'),
    x.quantity,
    x.average_price,
    x.current_price,
    coalesce(x.currency, 'EUR'),
    x.previous_close,
    now()
  from jsonb_to_recordset(p_rows) as x(
    instrument_id  uuid,
    provider       text,
    quantity       numeric,
    average_price  numeric,
    current_price  numeric,
    currency       char(3),
    previous_close numeric
  )
  on conflict (user_id, instrument_id, provider) do update set
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

create or replace function public.reset_t212_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.transactions where user_id = v_uid and source = 't212_sync';
  delete from public.holdings where user_id = v_uid and provider = 't212';
  delete from public.broker_accounts where user_id = v_uid and provider = 't212';
  delete from public.sync_state where user_id = v_uid and provider = 't212';
  delete from public.sync_runs where user_id = v_uid and provider = 't212';
end;
$$;

revoke execute on function public.reset_t212_sync() from public;
grant execute on function public.reset_t212_sync() to authenticated;

create or replace function public.set_broker_total(
  p_user uuid,
  p_total numeric,
  p_provider text default 't212'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.broker_accounts
    set total = p_total, updated_at = now()
    where user_id = p_user and provider = coalesce(p_provider, 't212');
end;
$$;

revoke execute on function public.set_broker_total(uuid, numeric, text) from public;
revoke execute on function public.set_broker_total(uuid, numeric, text) from authenticated;
grant execute on function public.set_broker_total(uuid, numeric, text) to service_role;
