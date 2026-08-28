create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'manga-wave-source-sync') then
    perform cron.unschedule('manga-wave-source-sync');
  end if;

  perform cron.schedule(
    'manga-wave-source-sync',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/source-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'source_sync_service_role_key'
            limit 1
          )
        ),
        body := '{"batchSize":2}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
end;
$$;
