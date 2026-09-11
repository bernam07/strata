-- Let a user correct the Yahoo symbol used to price one of their instruments.
-- The auto-resolver (ISIN search) sometimes picks the wrong listing — e.g. a
-- US stock matched to a foreign exchange in another currency — which then gets
-- cached and keeps the price wrong. This scoped, security-definer function lets
-- the owner set the right symbol (or clear it, '' -> NULL, to re-resolve).

create or replace function public.set_instrument_yahoo_mine(p_id uuid, p_symbol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.instruments
     set yahoo_symbol = nullif(upper(btrim(p_symbol)), '')
   where id = p_id
     and user_id = (select auth.uid());
end;
$$;

revoke execute on function public.set_instrument_yahoo_mine(uuid, text) from public;
grant execute on function public.set_instrument_yahoo_mine(uuid, text) to authenticated;
