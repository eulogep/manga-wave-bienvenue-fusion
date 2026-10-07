-- Prérequis : déployer d'abord la fonction catalog-sync.
-- Réutilise le JWT service_role déjà stocké pour le worker source-sync.
-- Sa valeur ne doit jamais être ajoutée à ce fichier ou au dépôt.

-- Supprime une éventuelle planification précédente du même nom.
do $$
declare
  scheduled_job bigint;
begin
  select jobid into scheduled_job
  from cron.job
  where jobname = 'mangadex-catalog-daily';

  if scheduled_job is not null then
    perform cron.unschedule(scheduled_job);
  end if;
end;
$$;

-- Synchronise au plus 100 titres une fois par jour à 03:17 UTC.
select cron.schedule(
  'mangadex-catalog-daily',
  '17 3 * * *',
  $$
  select net.http_post(
    url := 'https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/catalog-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'source_sync_service_role_key'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
