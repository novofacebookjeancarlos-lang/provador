alter table public.pilot_stores add column suspended boolean not null default false;

create function public.pilot_admin_overview(p_actor uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'stores', coalesce((select jsonb_agg(to_jsonb(s)) from
      (select id,name,generation_budget,daily_limit,suspended from public.pilot_stores
       order by name,id limit 250) s), '[]'::jsonb),
    'store_count', (select count(*) from public.pilot_stores),
    'proof_count', (select count(*) from public.pilot_attempts where state = 'completed'),
    'pending_count', (select count(*) from public.pilot_recharge_requests where status = 'pending')
  )
  where exists(select 1 from public.pilot_operators where user_id = p_actor);
$$;

create function public.pilot_admin_store(p_actor uuid, p_store uuid, p_limit integer, p_suspended boolean)
returns boolean language sql security invoker set search_path = '' as $$
  with changed as (
    update public.pilot_stores set daily_limit=p_limit, suspended=p_suspended
    where id=p_store and p_limit between 1 and 1000
      and exists(select 1 from public.pilot_operators where user_id=p_actor)
    returning id
  ) select exists(select from changed);
$$;

revoke all on function public.pilot_admin_overview(uuid),
  public.pilot_admin_store(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.pilot_admin_overview(uuid),
  public.pilot_admin_store(uuid,uuid,integer,boolean) to service_role;

create or replace function public.pilot_variant(p_store uuid, p_variant text)
returns uuid language sql stable security invoker set search_path = '' as $$
  select p.id from public.pilot_pieces p join public.pilot_stores s on s.id = p.store_id
  where p.store_id = p_store and p.external_variant_id = p_variant and p.enabled and not s.suspended;
$$;

create or replace function public.pilot_public_piece(p_piece uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('name', p.name, 'store', s.name, 'image_key', p.image_key,
    'garment_url', p.garment_url, 'product_url', p.product_url)
  from public.pilot_pieces p join public.pilot_stores s on s.id = p.store_id
  where p.id = p_piece and p.enabled and not s.suspended;
$$;

create or replace function public.reserve_pilot_tryon(piece_id uuid, request_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare chosen public.pilot_pieces%rowtype; shop public.pilot_stores%rowtype;
begin
  select * into chosen from public.pilot_pieces p where p.id = $1 and p.enabled;
  if not found then return null; end if;

  select * into shop from public.pilot_stores s where s.id = chosen.store_id for update;
  if shop.suspended or shop.generation_budget <= 0 then return null; end if;
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
