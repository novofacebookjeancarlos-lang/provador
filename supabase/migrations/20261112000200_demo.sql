create table public.demo_tryon_attempts (
  id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.demo_tryon_attempts enable row level security;
revoke all on public.demo_tryon_attempts from anon, authenticated;
grant select, insert on public.demo_tryon_attempts to service_role;

create function public.reserve_demo_tryon(request_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20261112, 2);
  if (select count(*) from public.demo_tryon_attempts) >= 20 then
    return false;
  end if;
  insert into public.demo_tryon_attempts (id) values ($1) on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.reserve_demo_tryon(uuid) from public, anon, authenticated;
grant execute on function public.reserve_demo_tryon(uuid) to service_role;
