create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id  uuid,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references categories (id, user_id) on delete cascade
);

alter table categories enable row level security;
create index categories_user_idx on categories (user_id);

create policy categories_select on categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy categories_insert on categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy categories_update on categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy categories_delete on categories for delete to authenticated
  using ((select auth.uid()) = user_id);

create table transaction_categories (
  transaction_id uuid not null,
  user_id        uuid not null default auth.uid(),
  category_id    uuid not null,
  updated_at     timestamptz not null default now(),
  primary key (transaction_id),
  foreign key (transaction_id, user_id)
    references transactions (id, user_id) on delete cascade,
  foreign key (category_id, user_id)
    references categories (id, user_id) on delete cascade
);

alter table transaction_categories enable row level security;
create index transaction_categories_user_idx on transaction_categories (user_id);

create policy transaction_categories_select on transaction_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy transaction_categories_insert on transaction_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transaction_categories_update on transaction_categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy transaction_categories_delete on transaction_categories
  for delete to authenticated using ((select auth.uid()) = user_id);
