alter table public.generation_daily_budget add column blocked_alerted_at timestamptz;

create or replace function public.generation_reserve(
  p_request uuid, p_piece uuid, p_daily bigint, p_unit bigint, p_model text, p_quality text, p_size text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  day_key date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  total bigint;
  alert_sent timestamptz;
  blocked_alert_sent timestamptz;
  crossed boolean;
  shop uuid;
begin
  if p_daily is null or p_unit is null or p_daily < 1 or p_unit < 1 or p_daily > 1000000000000
  then return jsonb_build_object('status', 'budget'); end if;

  insert into public.generation_daily_budget(day) values(day_key) on conflict do nothing;
  select reserved_micro_usd, alerted_at, blocked_alerted_at into total, alert_sent, blocked_alert_sent
    from public.generation_daily_budget where day = day_key for update;
  if p_unit > p_daily - total then
    if blocked_alert_sent is null then
      update public.generation_daily_budget set blocked_alerted_at = now() where day = day_key;
    end if;
    return jsonb_build_object('status', 'budget', 'alert', blocked_alert_sent is null,
      'day', day_key, 'reserved', total);
  end if;
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

