alter table public.pilot_stores add column owner_id uuid unique references auth.users(id);
alter table public.pilot_pieces add column name text not null default 'Peça';
alter table public.pilot_pieces add column product_url text;
alter table public.pilot_pieces add column image_key text;
alter table public.pilot_attempts add column state text not null default 'reserved'
  check (state in ('reserved', 'completed', 'failed', 'unknown'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provador-produtos', 'provador-produtos', false, 4000000, array['image/jpeg'])
on conflict (id) do nothing;

create table public.pilot_credit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.pilot_stores(id),
  amount integer not null check (amount > 0),
  payment_reference text not null unique,
  created_at timestamptz not null default now()
);
alter table public.pilot_credit_events enable row level security;
revoke all on public.pilot_credit_events from anon, authenticated;
grant select, insert on public.pilot_credit_events to service_role;

create function public.pilot_credit(p_store uuid, p_amount integer, p_reference text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.pilot_credit_events(store_id, amount, payment_reference)
  values (p_store, p_amount, p_reference) on conflict (payment_reference) do nothing;
  if not found then return false; end if;
  update public.pilot_stores set generation_budget = generation_budget + p_amount where id = p_store;
  return true;
end;
$$;

create function public.pilot_dashboard(p_owner uuid, p_name text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare shop public.pilot_stores;
begin
  if p_name is not null then
    insert into public.pilot_stores(owner_id, name, generation_budget)
    values (p_owner, p_name, 0) on conflict (owner_id) do nothing;
  end if;
  select * into shop from public.pilot_stores where owner_id = p_owner;
  if not found then return null; end if;
  return jsonb_build_object('store', to_jsonb(shop) - 'owner_id',
    'pieces', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
      'enabled', p.enabled, 'product_url', p.product_url) order by p.name)
      from public.pilot_pieces p where p.store_id = shop.id), '[]'::jsonb),
    'completed', (select count(*) from public.pilot_attempts a where a.store_id = shop.id and a.state = 'completed'),
    'reserved', (select count(*) from public.pilot_attempts a where a.store_id = shop.id and a.state in ('reserved', 'unknown')));
end;
$$;

create function public.pilot_save_piece(p_owner uuid, p_piece uuid, p_name text, p_key text, p_url text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.pilot_pieces(id, store_id, name, garment_url, image_key, product_url, enabled)
  select p_piece, s.id, p_name, '', p_key, p_url, true
  from public.pilot_stores s where s.owner_id = p_owner and p_key = s.id || '/' || p_piece || '.jpg';
  return found;
end;
$$;

create function public.pilot_toggle_piece(p_owner uuid, p_piece uuid, p_enabled boolean)
returns boolean language sql security invoker set search_path = '' as $$
  with changed as (
    update public.pilot_pieces p set enabled = p_enabled from public.pilot_stores s
    where p.store_id = s.id and s.owner_id = p_owner and p.id = p_piece returning p.id
  ) select exists(select from changed);
$$;

create function public.pilot_public_piece(p_piece uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('name', p.name, 'store', s.name, 'image_key', p.image_key,
    'garment_url', p.garment_url, 'product_url', p.product_url)
  from public.pilot_pieces p join public.pilot_stores s on s.id = p.store_id
  where p.id = p_piece and p.enabled;
$$;

create function public.pilot_settle(p_request uuid, p_state text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare shop uuid;
begin
  if p_state not in ('completed', 'failed', 'unknown') then raise exception 'invalid state'; end if;
  update public.pilot_attempts a set state = p_state
  where a.id = p_request and a.state = 'reserved' returning a.store_id into shop;
  if not found then return false; end if;
  if p_state = 'failed' then
    update public.pilot_stores set generation_budget = generation_budget + 1 where id = shop;
  end if;
  return true;
end;
$$;

grant insert on public.pilot_stores to service_role;
grant insert, update on public.pilot_pieces to service_role;
grant update on public.pilot_attempts to service_role;

revoke all on function public.pilot_credit(uuid, integer, text),
  public.pilot_dashboard(uuid, text), public.pilot_save_piece(uuid, uuid, text, text, text),
  public.pilot_toggle_piece(uuid, uuid, boolean), public.pilot_public_piece(uuid),
  public.pilot_settle(uuid, text) from public, anon, authenticated;
grant execute on function public.pilot_credit(uuid, integer, text),
  public.pilot_dashboard(uuid, text), public.pilot_save_piece(uuid, uuid, text, text, text),
  public.pilot_toggle_piece(uuid, uuid, boolean), public.pilot_public_piece(uuid),
  public.pilot_settle(uuid, text) to service_role;
