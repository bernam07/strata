alter table user_preferences
  add column if not exists daily_briefing boolean not null default false;

comment on column user_preferences.daily_briefing is
  'Whether the user receives the optional daily portfolio briefing push.';

do $$
begin
  perform cron.schedule(
    'daily-portfolio-briefing',
    '0 7 * * *',
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
      body := jsonb_build_object('action', 'daily-briefing'),
      timeout_milliseconds := 120000
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
    $cron$
  );
exception
  when others then
    raise notice 'Skipping daily briefing cron setup: %', sqlerrm;
end $$;