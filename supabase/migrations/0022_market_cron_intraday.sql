-- Move the market refresh from once a day to three times a day, so T212 values
-- (and therefore the iPhone widget, which reads them live) stay fresh through
-- the day. Times are in UTC — pg_cron runs in UTC — chosen to land near
-- 09:00 / 15:00 / 21:00 in mainland Portugal during summer time (UTC+1); in
-- winter (UTC+0) they fall an hour earlier. Adjust the hours if you want them
-- pinned to a different zone.
--
-- Idempotent and self-contained: it reuses the same Vault secrets described in
-- 0021 (project_url, service_role_key) and no-ops when they're absent.

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  begin
    perform cron.unschedule('daily-market-refresh');
  exception
    when others then null;
  end;

  begin
    perform cron.unschedule('market-refresh-intraday');
  exception
    when others then null;
  end;

  perform cron.schedule(
    'market-refresh-intraday',
    '0 8,14,20 * * *', -- ~09:00 / 15:00 / 21:00 Europe/Lisbon (summer)
    $cron$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets where name = 'project_url'
      ) || '/functions/v1/market',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
        )
      ),
      body := jsonb_build_object('action', 'refresh'),
      timeout_milliseconds := 120000
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
    $cron$
  );
exception
  when others then
    raise notice 'Skipping intraday market cron setup: %', sqlerrm;
end $$;
