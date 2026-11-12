create table public.pilot_operators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.pilot_recharge_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.pilot_stores(id),
  credits integer not null check (credits in (30, 100)),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create unique index pilot_recharge_one_pending on public.pilot_recharge_requests (store_id)
where status = 'pending';
alter table public.pilot_operators enable row level security;
alter table public.pilot_recharge_requests enable row level security;
revoke all on public.pilot_operators, public.pilot_recharge_requests from anon, authenticated;
grant select on public.pilot_operators to service_role;
grant select, insert, update on public.pilot_recharge_requests to service_role;

create function public.pilot_recharges(p_actor uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'operator', exists(select 1 from public.pilot_operators where user_id = p_actor),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select q.id, s.name as store, q.credits, q.amount_cents, q.status, q.created_at
        from public.pilot_recharge_requests q join public.pilot_stores s on s.id = q.store_id
        where s.owner_id = p_actor or (q.status = 'pending' and
          exists(select 1 from public.pilot_operators where user_id = p_actor))
        order by q.created_at desc limit 50
      ) r
    ), '[]'::jsonb)
  );
$$;

create function public.pilot_request_recharge(p_owner uuid, p_credits integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare request uuid;
begin
  if p_credits not in (30, 100) then return null; end if;
  insert into public.pilot_recharge_requests(store_id, credits, amount_cents)
    select s.id, p_credits, case p_credits when 30 then 4900 else 12900 end
    from public.pilot_stores s where s.owner_id = p_owner
    on conflict (store_id) where status = 'pending' do nothing
    returning id into request;
  return request;
end;
$$;

create function public.pilot_review_recharge(p_actor uuid, p_request uuid, p_approve boolean, p_reference text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.pilot_recharge_requests%rowtype;
begin
  if not exists(select 1 from public.pilot_operators where user_id = p_actor) then return false; end if;
  select * into item from public.pilot_recharge_requests
    where id = p_request and status = 'pending' for update;
  if not found then return false; end if;
  if p_approve then
    if p_reference is null or length(btrim(p_reference)) not between 4 and 120 then return false; end if;
    if not public.pilot_credit(item.store_id, item.credits, btrim(p_reference)) then return false; end if;
  end if;
  update public.pilot_recharge_requests set
    status = case when p_approve then 'confirmed' else 'cancelled' end,
    reviewed_at = now(), reviewed_by = p_actor
    where id = item.id;
  return true;
end;
$$;

revoke all on function public.pilot_recharges(uuid), public.pilot_request_recharge(uuid, integer),
  public.pilot_review_recharge(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.pilot_recharges(uuid), public.pilot_request_recharge(uuid, integer),
  public.pilot_review_recharge(uuid, uuid, boolean, text) to service_role;
