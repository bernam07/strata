-- Crypto moves from Yahoo to CoinGecko. CoinGecko identifies a coin by a slug
-- ("bitcoin", "ondo-finance") rather than a trading pair, so that becomes the
-- thing we price against; the symbol is kept purely for display.
alter table crypto_holdings add column if not exists coin_id text;
alter table crypto_holdings add column if not exists image_url text;

-- Yahoo stored a pair (BTC-EUR) in the symbol; the ticker alone is what we
-- show now. (user_id, symbol) is the primary key, so skip any row whose
-- stripped ticker would collide with a holding that already exists.
update crypto_holdings h
   set symbol = split_part(h.symbol, '-', 1)
 where h.symbol like '%-%'
   and not exists (
     select 1
       from crypto_holdings other
      where other.user_id = h.user_id
        and other.symbol = split_part(h.symbol, '-', 1)
   );

-- CoinGecko is queried with vs_currency=eur, so prices arrive in euro and the
-- FX step no longer applies. The stored price is refreshed on the next run.
update crypto_holdings set currency = 'EUR' where currency <> 'EUR';
