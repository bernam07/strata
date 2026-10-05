create table if not exists collectibles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null, -- 'pokemon', 'lego', 'watches', 'coins_bullion', 'wine', 'art', 'other'
  name text not null,
  identifier text, -- e.g. 'swsh4-25' for Pokemon, '75192' for LEGO
  quantity numeric(18, 4) not null default 1,
  purchase_price numeric(19, 6) not null default 0,
  purchase_currency char(3) not null default 'EUR',
  purchase_date date,
  current_price numeric(19, 6) not null default 0,
  condition text, -- 'raw_mint', 'near_mint', 'psa_10', 'sealed', 'used', etc.
  image_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table collectibles enable row level security;
create index if not exists collectibles_user_idx on collectibles (user_id);
create index if not exists collectibles_user_category_idx on collectibles (user_id, category);

create policy collectibles_select on collectibles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy collectibles_insert on collectibles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy collectibles_update on collectibles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy collectibles_delete on collectibles for delete to authenticated
  using ((select auth.uid()) = user_id);
