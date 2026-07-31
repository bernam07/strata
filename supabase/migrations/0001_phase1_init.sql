create extension if not exists pgcrypto;

create type account_type       as enum ('investment', 'cash', 'liability');
create type transaction_source as enum ('manual', 't212_sync', 'csv_import');
create type transaction_kind   as enum (
  'deposit', 'withdrawal', 'expense', 'income',
  'buy', 'sell', 'dividend', 'fee', 'interest',
  'transfer', 'adjustment'
);

create table institutions (
  id           text primary key,
  display_name text not null,
  brand_color  text not null,
  logo_path    text not null,
  sort_order   int  not null default 0
);

alter table institutions enable row level security;

create policy institutions_read on institutions
  for select to authenticated using (true);

insert into institutions (id, display_name, brand_color, logo_path, sort_order) values
  ('trading212',     'Trading 212',              '#00A9E0', '/institutions/trading212.svg',     10),
  ('trade_republic', 'Trade Republic',           '#111111', '/institutions/trade-republic.svg', 20),
  ('revolut',        'Revolut',                  '#0666EB', '/institutions/revolut.svg',        30),
  ('cgd',            'Caixa Geral de Depósitos', '#CC0033', '/institutions/cgd.svg',            40),
  ('moey',           'moey!',                    '#FF6A13', '/institutions/moey.svg',           50),
  ('bpi',            'BPI',                      '#0A5EA6', '/institutions/bpi.svg',            60),
  ('millennium',     'Millennium bcp',           '#D6001C', '/institutions/millennium.svg',     70),
  ('novo_banco',     'Novo Banco',               '#C4161C', '/institutions/novo-banco.svg',     80),
  ('santander',      'Santander',                '#EC0000', '/institutions/santander.svg',      90),
  ('activobank',     'ActivoBank',               '#00B0AA', '/institutions/activobank.svg',    100),
  ('cash',           'Dinheiro físico',          '#6B7280', '/institutions/cash.svg',          110);

create table accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  institution_id text not null references institutions (id),
  name           text not null,
  type           account_type not null,
  currency       char(3) not null default 'EUR',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  unique (id, user_id)
);

alter table accounts enable row level security;
create index accounts_user_id_idx on accounts (user_id);

create policy accounts_select on accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy accounts_insert on accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy accounts_update on accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy accounts_delete on accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

create table transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  account_id        uuid not null,
  kind              transaction_kind not null,
  amount            numeric(19,4) not null,
  quantity          numeric(24,8),
  currency          char(3) not null default 'EUR',
  fx_rate           numeric(19,8) not null default 1,
  occurred_at       timestamptz not null,
  note              text,
  source            transaction_source not null default 'manual',
  external_id       text,
  transfer_group_id uuid,
  created_at        timestamptz not null default now(),
  foreign key (account_id, user_id)
    references accounts (id, user_id) on delete cascade
);

alter table transactions enable row level security;

create index transactions_account_idx   on transactions (account_id);
create index transactions_user_time_idx on transactions (user_id, occurred_at desc);
create index transactions_transfer_idx  on transactions (transfer_group_id)
  where transfer_group_id is not null;

create unique index transactions_dedup_idx
  on transactions (account_id, source, external_id)
  where external_id is not null;

create policy transactions_select on transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy transactions_insert on transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_touch before update on accounts
  for each row execute function set_updated_at();
