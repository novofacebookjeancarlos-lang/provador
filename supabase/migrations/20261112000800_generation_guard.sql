create table public.generation_daily_budget (
  day date primary key,
  reserved_micro_usd bigint not null default 0,
  alerted_at timestamptz
);
create table public.generation_ip_windows (
  ip_hash text not null,
  minute timestamptz not null,
  hits integer not null,
  primary key (minute, ip_hash)
);
create table public.generation_telemetry (
  request_id uuid primary key,
  store_id uuid references public.pilot_stores(id),
  model text not null,
  quality text not null,
  size text not null,
  started_at timestamptz not null default now(),
  duration_ms integer,
  error_code text,
  usage jsonb
);
alter table public.generation_daily_budget enable row level security;
alter table public.generation_ip_windows enable row level security;
alter table public.generation_telemetry enable row level security;
revoke all on public.generation_daily_budget, public.generation_ip_windows, public.generation_telemetry from anon, authenticated;
grant select, insert, update on public.generation_daily_budget, public.generation_ip_windows, public.generation_telemetry to service_role;
grant delete on public.generation_ip_windows to service_role;

create function public.generation_rate(p_ip text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  current_minute timestamptz := date_trunc('minute', statement_timestamp());
  allowed boolean;
begin
  if p_ip is null or p_ip !~ '^[a-f0-9]{64}$' or p_limit is null or p_limit < 1 then return false; end if;
  insert into public.generation_ip_windows(ip_hash, minute, hits) values(p_ip, current_minute, 1)
  on conflict (minute, ip_hash) do update set hits = generation_ip_windows.hits + 1
  where generation_ip_windows.hits < p_limit;
  allowed := found;
  if allowed and mod(extract(epoch from current_minute)::bigint / 60, 10) = 0 then
    delete from public.generation_ip_windows where minute < current_minute - interval '10 minutes';
  end if;
  return allowed;
end;
$$;

create function public.generation_reserve(
  p_request uuid, p_piece uuid, p_daily bigint, p_unit bigint, p_model text, p_quality text, p_size text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  day_key date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  total bigint;
  alert_sent timestamptz;
  crossed boolean;
  shop uuid;
begin
  if p_daily is null or p_unit is null or p_daily < 1 or p_unit < 1 or p_daily > 1000000000000
  then return jsonb_build_object('status', 'budget'); end if;

  insert into public.generation_daily_budget(day) values(day_key) on conflict do nothing;
  select reserved_micro_usd, alerted_at into total, alert_sent
    from public.generation_daily_budget where day = day_key for update;
  if p_unit > p_daily - total then return jsonb_build_object('status', 'budget'); end if;
  if exists(select 1 from public.generation_telemetry where request_id = p_request)
  then return jsonb_build_object('status', 'duplicate'); end if;

  if p_piece is null then
    if not public.reserve_demo_tryon(p_request) then return jsonb_build_object('status', 'demo'); end if;
  else
    if public.reserve_pilot_tryon(p_piece, p_request) is null then return jsonb_build_object('status', 'store'); end if;
    select store_id into strict shop from public.pilot_attempts where id = p_request;
  end if;

  total := total + p_unit;
  crossed := alert_sent is null and total * 5 >= p_daily * 4;
  update public.generation_daily_budget
    set reserved_micro_usd = total, alerted_at = case when crossed then now() else alerted_at end
    where day = day_key;
  insert into public.generation_telemetry(request_id, store_id, model, quality, size)
    values(p_request, shop, p_model, p_quality, p_size);
  return jsonb_build_object('status', 'allowed', 'alert', crossed, 'day', day_key, 'reserved', total);
end;
$$;

create function public.generation_finish(p_request uuid, p_duration integer, p_error text, p_usage jsonb)
returns void language sql security invoker set search_path = '' as $$
  update public.generation_telemetry set duration_ms = p_duration, error_code = p_error, usage = p_usage
  where request_id = p_request and duration_ms is null;
$$;

revoke all on function public.generation_rate(text,integer),
  public.generation_reserve(uuid,uuid,bigint,bigint,text,text,text),
  public.generation_finish(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.generation_rate(text,integer),
  public.generation_reserve(uuid,uuid,bigint,bigint,text,text,text),
  public.generation_finish(uuid,integer,text,jsonb) to service_role;
