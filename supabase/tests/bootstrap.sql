create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);

-- Reproduce grants from a hosted installation in addition to PostgreSQL defaults.
alter default privileges for role postgres grant execute on functions to anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated;
