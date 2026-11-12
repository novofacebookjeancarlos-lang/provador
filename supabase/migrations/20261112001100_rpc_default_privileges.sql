-- Schema-specific revokes cannot cancel the built-in global PUBLIC grant.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
