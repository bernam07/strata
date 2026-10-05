-- Migration 0030: Rebrickable API key support in provider_credentials and vault

create or replace function public.set_rebrickable_api_key(p_key text)
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
  v_name := 'rebrickable_api_key_' || v_uid::text;

  select secret_id into v_secret from public.provider_credentials
    where user_id = v_uid and provider = 'rebrickable';

  if v_secret is null then
    v_secret := vault.create_secret(p_key, v_name, 'Rebrickable API key');
    insert into public.provider_credentials (user_id, provider, secret_id, use_demo)
      values (v_uid, 'rebrickable', v_secret, false);
  else
    perform vault.update_secret(v_secret, p_key);
    update public.provider_credentials
      set updated_at = now()
      where user_id = v_uid and provider = 'rebrickable';
  end if;
end;
$$;

revoke execute on function public.set_rebrickable_api_key(text) from public;
grant execute on function public.set_rebrickable_api_key(text) to authenticated;

create or replace function public.remove_rebrickable_api_key()
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
    where user_id = v_uid and provider = 'rebrickable';
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
    delete from public.provider_credentials where user_id = v_uid and provider = 'rebrickable';
  end if;
end;
$$;

revoke execute on function public.remove_rebrickable_api_key() from public;
grant execute on function public.remove_rebrickable_api_key() to authenticated;

create or replace function public.get_rebrickable_api_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select d.decrypted_secret into v_key
    from public.provider_credentials c
    join vault.decrypted_secrets d on d.id = c.secret_id
    where c.user_id = v_uid and c.provider = 'rebrickable';
  return v_key;
end;
$$;

revoke execute on function public.get_rebrickable_api_key() from public;
grant execute on function public.get_rebrickable_api_key() to authenticated;
