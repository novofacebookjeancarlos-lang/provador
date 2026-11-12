-- Fresh Postgres can install pgcrypto into public. Keep its helper RPCs out
-- of the API schema, as on Supabase projects with pgcrypto in extensions.
do $$
begin
  if exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'public'
  ) then
    create schema if not exists extensions;
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;
