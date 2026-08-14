-- Daily market refresh + net-worth snapshot, so prices and history stay fresh
-- even when the app is never opened.
--
-- This schedules a call to the `market` edge function (action=refresh) once a
-- day. Refresh reprices holdings, updates broker totals, evaluates alerts and
-- records a daily investment snapshot for every user.
--
-- The function is called with the project's service-role key, which must never
-- live in source control. It is read at run time from two Vault secrets you set
-- once per project (Dashboard → Project Settings → Vault, or the SQL below):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>',                'service_role_key');
--
-- Until those secrets exist the scheduled job simply no-ops on each run; adding
-- them later needs no migration change.

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  -- Idempotent: drop any previous definition before (re)scheduling.
  begin
    perform cron.unschedule('daily-market-refresh');
  exception
    when others then null;
  end;

  perform cron.schedule(
    'daily-market-refresh',
    '30 6 * * *', -- 06:30 UTC daily, after most markets have settled the prior close
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
    -- Local/dev databases may lack pg_cron/pg_net or Vault; don't fail the run.
    raise notice 'Skipping market cron setup: %', sqlerrm;
end $$;
