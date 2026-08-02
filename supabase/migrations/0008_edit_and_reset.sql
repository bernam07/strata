create policy transactions_update_manual on transactions
  for update to authenticated
  using ((select auth.uid()) = user_id and source = 'manual')
  with check ((select auth.uid()) = user_id and source = 'manual');

create policy transactions_delete_manual on transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id and source = 'manual');

create function public.reset_t212_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.transactions where user_id = v_uid and source = 't212_sync';
  delete from public.holdings where user_id = v_uid;
  delete from public.broker_accounts where user_id = v_uid and provider = 't212';
  delete from public.sync_state where user_id = v_uid and provider = 't212';
  delete from public.sync_runs where user_id = v_uid and provider = 't212';
end;
$$;

revoke execute on function public.reset_t212_sync() from public;
grant execute on function public.reset_t212_sync() to authenticated;

create function public.clear_sync_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.sync_runs where user_id = v_uid and provider = 't212';
end;
$$;

revoke execute on function public.clear_sync_history() from public;
grant execute on function public.clear_sync_history() to authenticated;
