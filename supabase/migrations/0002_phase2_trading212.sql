create type sync_status as enum ('running', 'success', 'error');

create table instruments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  isin        text,
  ticker      text not null,
  t212_ticker text,
  name        text not null,
  currency    char(3) not null default 'EUR',
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);

alter table instruments enable row level security;
create index instruments_user_idx on instruments (user_id);
create unique index instruments_user_t212_idx
  on instruments (user_id, t212_ticker) where t212_ticker is not null;
create unique index instruments_user_isin_idx
  on instruments (user_id, isin) where isin is not null;

create policy instruments_select on instruments for select to authenticated
  using ((select auth.uid()) = user_id);

alter table transactions
  add column instrument_id uuid,
  add constraint transactions_instrument_fkey
    foreign key (instrument_id, user_id)
    references instruments (id, user_id) on delete set null;

create table provider_credentials (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider   text not null,
  secret_id  uuid not null,
  use_demo   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table provider_credentials enable row level security;

create policy provider_credentials_select on provider_credentials
  for select to authenticated using ((select auth.uid()) = user_id);
create policy provider_credentials_delete on provider_credentials
  for delete to authenticated using ((select auth.uid()) = user_id);

create table sync_state (
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null,
  stream     text not null,
  cursor     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, stream)
);

alter table sync_state enable row level security;
create policy sync_state_select on sync_state for select to authenticated
  using ((select auth.uid()) = user_id);

create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  provider      text not null,
  status        sync_status not null default 'running',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  inserted_rows int not null default 0,
  error_message text
);

alter table sync_runs enable row level security;
create index sync_runs_user_started_idx on sync_runs (user_id, started_at desc);
create policy sync_runs_select on sync_runs for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_t212_api_key(p_key text, p_use_demo boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_name := 't212_api_key_' || v_uid::text;

  select secret_id into v_secret from public.provider_credentials
    where user_id = v_uid and provider = 't212';

  if v_secret is null then
    v_secret := vault.create_secret(p_key, v_name, 'Trading 212 API key');
    insert into public.provider_credentials (user_id, provider, secret_id, use_demo)
      values (v_uid, 't212', v_secret, p_use_demo);
  else
    perform vault.update_secret(v_secret, p_key);
    update public.provider_credentials
      set use_demo = p_use_demo, updated_at = now()
      where user_id = v_uid and provider = 't212';
  end if;
end;
$$;

revoke execute on function public.set_t212_api_key(text, boolean) from public;
grant execute on function public.set_t212_api_key(text, boolean) to authenticated;

create function public.remove_t212_api_key()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select secret_id into v_secret from public.provider_credentials
    where user_id = v_uid and provider = 't212';
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
    delete from public.provider_credentials where user_id = v_uid and provider = 't212';
  end if;
end;
$$;

revoke execute on function public.remove_t212_api_key() from public;
grant execute on function public.remove_t212_api_key() to authenticated;

create function public.provider_secret(p_user uuid, p_provider text)
returns table (secret text, use_demo boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select d.decrypted_secret, c.use_demo
    from public.provider_credentials c
    join vault.decrypted_secrets d on d.id = c.secret_id
    where c.user_id = p_user and c.provider = p_provider;
end;
$$;

revoke execute on function public.provider_secret(uuid, text) from public;
revoke execute on function public.provider_secret(uuid, text) from authenticated;
grant execute on function public.provider_secret(uuid, text) to service_role;

create function public.ingest_transactions(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(p_rows) as x(
      user_id           uuid,
      account_id        uuid,
      instrument_id     uuid,
      kind              public.transaction_kind,
      amount            numeric,
      quantity          numeric,
      currency          char(3),
      fx_rate           numeric,
      occurred_at       timestamptz,
      note              text,
      source            public.transaction_source,
      external_id       text,
      transfer_group_id uuid
    )
  ),
  affected as (
    insert into public.transactions (
      user_id, account_id, instrument_id, kind, amount, quantity,
      currency, fx_rate, occurred_at, note, source, external_id, transfer_group_id
    )
    select
      user_id, account_id, instrument_id, kind, amount, quantity,
      coalesce(currency, 'EUR'), coalesce(fx_rate, 1), occurred_at, note,
      source, external_id, transfer_group_id
    from incoming
    on conflict (account_id, source, external_id)
      where external_id is not null do nothing
    returning 1
  )
  select count(*) into v_inserted from affected;
  return v_inserted;
end;
$$;

revoke execute on function public.ingest_transactions(jsonb) from public;
revoke execute on function public.ingest_transactions(jsonb) from authenticated;
grant execute on function public.ingest_transactions(jsonb) to service_role;
