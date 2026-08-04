create table instrument_notes (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument_id uuid not null,
  body          text not null,
  updated_at    timestamptz not null default now(),
  primary key (user_id, instrument_id),
  foreign key (instrument_id, user_id)
    references instruments (id, user_id) on delete cascade
);

alter table instrument_notes enable row level security;

create policy instrument_notes_select on instrument_notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy instrument_notes_insert on instrument_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy instrument_notes_update on instrument_notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy instrument_notes_delete on instrument_notes for delete to authenticated
  using ((select auth.uid()) = user_id);
