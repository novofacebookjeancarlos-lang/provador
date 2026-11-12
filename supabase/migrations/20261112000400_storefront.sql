alter table public.pilot_pieces add column external_variant_id text
  check (external_variant_id ~ '^[A-Za-z0-9_-]{1,80}$');
create unique index pilot_piece_store_variant on public.pilot_pieces (store_id, external_variant_id)
  where external_variant_id is not null;

alter table public.pilot_stores add column daily_limit integer not null default 20
  check (daily_limit between 1 and 1000);
create index pilot_attempt_store_time on public.pilot_attempts (store_id, created_at desc);

create function public.pilot_variant(p_store uuid, p_variant text)
returns uuid language sql stable security invoker set search_path = '' as $$
  select p.id from public.pilot_pieces p
  where p.store_id = p_store and p.external_variant_id = p_variant and p.enabled;
$$;

create function public.pilot_set_variant(p_owner uuid, p_piece uuid, p_variant text)
returns boolean language sql security invoker set search_path = '' as $$
  with changed as (
    update public.pilot_pieces p set external_variant_id = p_variant
    from public.pilot_stores s where p.store_id = s.id and s.owner_id = p_owner and p.id = p_piece
    returning p.id
  ) select exists(select from changed);
$$;

create function public.pilot_variants(p_owner uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(p.id::text, p.external_variant_id), '{}'::jsonb)
  from public.pilot_pieces p join public.pilot_stores s on s.id = p.store_id
  where s.owner_id = p_owner and p.external_variant_id is not null;
$$;

create or replace function public.reserve_pilot_tryon(piece_id uuid, request_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare chosen public.pilot_pieces%rowtype; shop public.pilot_stores%rowtype;
begin
  select * into chosen from public.pilot_pieces p where p.id = $1 and p.enabled;
  if not found then return null; end if;

  select * into shop from public.pilot_stores s where s.id = chosen.store_id for update;
  if shop.generation_budget <= 0 then return null; end if;
  if exists (select 1 from public.pilot_attempts a where a.id = $2) then return null; end if;
  if (select count(*) from public.pilot_attempts a
      where a.store_id = shop.id and a.created_at > now() - interval '24 hours') >= shop.daily_limit
  then return null; end if;

  insert into public.pilot_attempts (id, store_id, piece_id)
    values ($2, shop.id, chosen.id) on conflict (id) do nothing;
  if not found then return null; end if;

  update public.pilot_stores set generation_budget = generation_budget - 1 where id = shop.id;
  return chosen.garment_url;
end;
$$;

revoke all on function public.pilot_variant(uuid, text), public.pilot_set_variant(uuid, uuid, text),
  public.pilot_variants(uuid) from public, anon, authenticated;
grant execute on function public.pilot_variant(uuid, text), public.pilot_set_variant(uuid, uuid, text),
  public.pilot_variants(uuid) to service_role;
