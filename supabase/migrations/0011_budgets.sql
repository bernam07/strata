create table budgets (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id   uuid not null,
  monthly_limit numeric(19,4) not null check (monthly_limit >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, category_id),
  foreign key (category_id, user_id)
    references categories (id, user_id) on delete cascade
);

alter table budgets enable row level security;
create index budgets_user_idx on budgets (user_id);

create policy budgets_select on budgets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budgets_insert on budgets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budgets_update on budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy budgets_delete on budgets for delete to authenticated
  using ((select auth.uid()) = user_id);
