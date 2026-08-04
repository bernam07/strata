alter table instruments add column if not exists sector text;

create function public.set_instrument_sector(p_id uuid, p_sector text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.instruments set sector = p_sector where id = p_id;
end;
$$;

revoke execute on function public.set_instrument_sector(uuid, text) from public;
revoke execute on function public.set_instrument_sector(uuid, text) from authenticated;
grant execute on function public.set_instrument_sector(uuid, text) to service_role;
