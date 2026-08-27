-- Prérequis : déployer d'abord la fonction catalog-sync.
-- Dans Supabase Vault, créer les deux secrets suivants avec les valeurs réelles :
--   catalog_sync_project_url : https://ilmsomiaqthhfyvgqnsp.supabase.co
--   catalog_sync_secret_key  : une clé Supabase de type Secret du projet
-- Les valeurs de secret ne doivent jamais être ajoutées à ce fichier ou au dépôt.

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
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_project_url') || '/functions/v1/catalog-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_secret_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
