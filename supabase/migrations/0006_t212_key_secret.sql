drop function if exists public.set_t212_api_key(text, boolean);

create function public.set_t212_api_key(
  p_key text,
  p_secret text,
  p_use_demo boolean default false
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
  v_value text := p_key || ':' || p_secret;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_name := 't212_api_key_' || v_uid::text;

  select secret_id into v_secret from public.provider_credentials
    where user_id = v_uid and provider = 't212';

  if v_secret is null then
    v_secret := vault.create_secret(v_value, v_name, 'Trading 212 API key:secret');
    insert into public.provider_credentials (user_id, provider, secret_id, use_demo)
      values (v_uid, 't212', v_secret, p_use_demo);
  else
    perform vault.update_secret(v_secret, v_value);
    update public.provider_credentials
      set use_demo = p_use_demo, updated_at = now()
      where user_id = v_uid and provider = 't212';
  end if;
end;
$$;

revoke execute on function public.set_t212_api_key(text, text, boolean) from public;
grant execute on function public.set_t212_api_key(text, text, boolean) to authenticated;
