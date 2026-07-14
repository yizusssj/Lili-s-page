-- Plantilla: reemplaza únicamente los valores *_HERE antes de ejecutarla.
-- CRON_SECRET_HERE debe ser exactamente el mismo valor configurado en la Edge Function.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://PROJECT_REF_HERE.supabase.co',
  'push_project_url'
);

select vault.create_secret(
  'CRON_SECRET_HERE',
  'push_cron_secret'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-lili-reminders';

select cron.schedule(
  'send-lili-reminders',
  '* * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'push_project_url'
      ) || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'push_cron_secret'
        )
      ),
      body := jsonb_build_object('scheduled_at', now())
    );
  $$
);
