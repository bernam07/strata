create table recurring_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null,
  kind        transaction_kind not null,
  amount      numeric(19,4) not null check (amount >= 0),
  note        text,
  category_id uuid,
  cadence     text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_run    date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  foreign key (account_id, user_id)
    references accounts (id, user_id) on delete cascade,
  foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null
);

alter table recurring_transactions enable row level security;
create index recurring_transactions_user_idx on recurring_transactions (user_id);

create policy recurring_transactions_select on recurring_transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_transactions_insert on recurring_transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recurring_transactions_update on recurring_transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy recurring_transactions_delete on recurring_transactions for delete to authenticated
  using ((select auth.uid()) = user_id);
