-- Migration 0033: remove deprecated paid LEGO provider credentials and RPCs

do $$
declare
  secret_id uuid;
begin
  for secret_id in
    select c.secret_id
    from public.provider_credentials c
    where c.provider in ('brickeconomy', 'bricklink')
  loop
    delete from vault.secrets where id = secret_id;
  end loop;
  delete from public.provider_credentials where provider in ('brickeconomy', 'bricklink');
end;
$$;

drop function if exists public.get_brickeconomy_api_key();
drop function if exists public.set_brickeconomy_api_key(text);
drop function if exists public.delete_brickeconomy_api_key();
drop function if exists public.remove_brickeconomy_api_key();
drop function if exists public.get_bricklink_credentials();
drop function if exists public.set_bricklink_credentials(text, text, text, text);
drop function if exists public.remove_bricklink_credentials();
