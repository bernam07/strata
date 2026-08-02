create table widget_tokens (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table widget_tokens enable row level security;

create policy widget_tokens_select on widget_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
create policy widget_tokens_delete on widget_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.create_widget_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.widget_tokens (user_id, token)
    values (v_uid, v_token)
    on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;

revoke execute on function public.create_widget_token() from public;
grant execute on function public.create_widget_token() to authenticated;
