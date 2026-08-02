create table broker_accounts (
  user_id    uuid not null default auth.uid(),
  provider   text not null,
  free       numeric(19,4) not null default 0,
  invested   numeric(19,4) not null default 0,
  ppl        numeric(19,4) not null default 0,
  total      numeric(19,4) not null default 0,
  currency   char(3) not null default 'EUR',
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table broker_accounts enable row level security;

create policy broker_accounts_select on broker_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.upsert_broker_cash(
  p_user uuid,
  p_provider text,
  p_free numeric,
  p_invested numeric,
  p_ppl numeric,
  p_total numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.broker_accounts (user_id, provider, free, invested, ppl, total, updated_at)
  values (p_user, p_provider, p_free, p_invested, p_ppl, p_total, now())
  on conflict (user_id, provider) do update set
    free = excluded.free,
    invested = excluded.invested,
    ppl = excluded.ppl,
    total = excluded.total,
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_broker_cash(uuid, text, numeric, numeric, numeric, numeric) from public;
revoke execute on function public.upsert_broker_cash(uuid, text, numeric, numeric, numeric, numeric) from authenticated;
grant execute on function public.upsert_broker_cash(uuid, text, numeric, numeric, numeric, numeric) to service_role;
