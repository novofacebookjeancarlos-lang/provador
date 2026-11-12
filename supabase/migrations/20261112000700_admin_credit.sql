create function public.pilot_admin_credit(p_actor uuid, p_store uuid, p_amount integer, p_reference text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.pilot_operators where user_id = p_actor)
    or not exists (select 1 from public.pilot_stores where id = p_store)
    or p_amount is null or p_amount not between 1 and 10000
    or p_reference is null or length(btrim(p_reference)) not between 4 and 120
  then return false; end if;
  return public.pilot_credit(p_store, p_amount, 'manual:' || btrim(p_reference));
end;
$$;
revoke all on function public.pilot_admin_credit(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.pilot_admin_credit(uuid,uuid,integer,text) to service_role;
