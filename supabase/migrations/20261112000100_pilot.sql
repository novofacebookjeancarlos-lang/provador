create table public.pilot_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  generation_budget integer not null default 20 check (generation_budget >= 0)
);

create table public.pilot_pieces (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.pilot_stores(id),
  garment_url text not null,
  enabled boolean not null default false,
  unique (store_id, id)
);

create table public.pilot_attempts (
  id uuid primary key,
  store_id uuid not null,
  piece_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (store_id, piece_id) references public.pilot_pieces(store_id, id)
);

alter table public.pilot_stores enable row level security;
alter table public.pilot_pieces enable row level security;
alter table public.pilot_attempts enable row level security;
revoke all on public.pilot_stores, public.pilot_pieces, public.pilot_attempts from anon, authenticated;
grant select, update on public.pilot_stores to service_role;
grant select on public.pilot_pieces to service_role;
grant select, insert, delete on public.pilot_attempts to service_role;

create function public.reserve_pilot_tryon(piece_id uuid, request_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  chosen public.pilot_pieces%rowtype;
begin
  select * into chosen from public.pilot_pieces p
    where p.id = $1 and p.enabled;
  if not found then return null; end if;

  insert into public.pilot_attempts (id, store_id, piece_id)
    values ($2, chosen.store_id, chosen.id) on conflict (id) do nothing;
  if not found then return null; end if;

  update public.pilot_stores
    set generation_budget = generation_budget - 1
    where id = chosen.store_id and generation_budget > 0;
  if not found then
    delete from public.pilot_attempts a where a.id = $2;
    return null;
  end if;
  return chosen.garment_url;
end;
$$;
revoke all on function public.reserve_pilot_tryon(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_pilot_tryon(uuid, uuid) to service_role;
