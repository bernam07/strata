-- Migration 0031: BrickLink API credentials (Consumer Key, Consumer Secret, Token Value, Token Secret) in provider_credentials and vault

create or replace function public.set_bricklink_credentials(
  p_consumer_key text,
  p_consumer_secret text,
  p_token_value text,
  p_token_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret uuid;
  v_name text;
  v_value text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_name := 'bricklink_credentials_' || v_uid::text;
  v_value := json_build_object(
    'consumerKey', p_consumer_key,
    'consumerSecret', p_consumer_secret,
    'tokenValue', p_token_value,
    'tokenSecret', p_token_secret
  )::text;

  select secret_id into v_secret from public.provider_credentials
    where user_id = v_uid and provider = 'bricklink';

  if v_secret is null then
    v_secret := vault.create_secret(v_value, v_name, 'BrickLink API credentials');
    insert into public.provider_credentials (user_id, provider, secret_id, use_demo)
      values (v_uid, 'bricklink', v_secret, false);
  else
    perform vault.update_secret(v_secret, v_value);
    update public.provider_credentials
      set updated_at = now()
      where user_id = v_uid and provider = 'bricklink';
  end if;
end;
$$;

revoke execute on function public.set_bricklink_credentials(text, text, text, text) from public;
grant execute on function public.set_bricklink_credentials(text, text, text, text) to authenticated;

create or replace function public.remove_bricklink_credentials()
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
    where user_id = v_uid and provider = 'bricklink';
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
    delete from public.provider_credentials where user_id = v_uid and provider = 'bricklink';
  end if;
end;
$$;

revoke execute on function public.remove_bricklink_credentials() from public;
grant execute on function public.remove_bricklink_credentials() to authenticated;

create or replace function public.get_bricklink_credentials()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_val text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select d.decrypted_secret into v_val
    from public.provider_credentials c
    join vault.decrypted_secrets d on d.id = c.secret_id
    where c.user_id = v_uid and c.provider = 'bricklink';
  return v_val;
end;
$$;

revoke execute on function public.get_bricklink_credentials() from public;
grant execute on function public.get_bricklink_credentials() to authenticated;
