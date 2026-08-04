create table allocation_targets (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument_id uuid not null,
  target_weight numeric(6,4) not null check (target_weight >= 0 and target_weight <= 1),
  updated_at    timestamptz not null default now(),
  primary key (user_id, instrument_id),
  foreign key (instrument_id, user_id)
    references instruments (id, user_id) on delete cascade
);

alter table allocation_targets enable row level security;

create policy allocation_targets_select on allocation_targets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy allocation_targets_insert on allocation_targets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy allocation_targets_update on allocation_targets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy allocation_targets_delete on allocation_targets for delete to authenticated
  using ((select auth.uid()) = user_id);
