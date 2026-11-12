do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  sa uuid; sb uuid; pa uuid; pb uuid; req uuid := gen_random_uuid();
  ref text := gen_random_uuid()::text;
begin
  insert into auth.users(id) values(a),(b);
  insert into public.pilot_stores(owner_id,name,generation_budget) values(a,'A',2) returning id into sa;
  insert into public.pilot_stores(owner_id,name,generation_budget) values(b,'B',0) returning id into sb;
  insert into public.pilot_pieces(store_id,garment_url,enabled,external_variant_id) values(sa,'asset',true,'123') returning id into pa;
  insert into public.pilot_pieces(store_id,garment_url,enabled,external_variant_id) values(sb,'asset',true,'123') returning id into pb;
  if public.pilot_variant(sa,'123') is distinct from pa or public.pilot_variant(sb,'123') is distinct from pb
    or public.pilot_toggle_piece(a,pb,false) then raise exception 'tenant isolation'; end if;
  if public.reserve_pilot_tryon(pb,req) is not null then raise exception 'zero credit'; end if;
  if public.reserve_pilot_tryon(pa,req) is null or public.reserve_pilot_tryon(pa,req) is not null then raise exception 'reservation or duplicate'; end if;
  if (select generation_budget from public.pilot_stores where id=sa) <> 1 then raise exception 'reserve balance'; end if;
  if not public.pilot_settle(req,'failed') or public.pilot_settle(req,'failed') then raise exception 'refund or duplicate'; end if;
  insert into public.pilot_operators(user_id) values(b);
  if public.pilot_admin_credit(a,sa,3,ref) or not public.pilot_admin_credit(b,sa,3,ref)
    or public.pilot_admin_credit(b,sa,3,ref) then raise exception 'admin or unique credit'; end if;
  if (select generation_budget from public.pilot_stores where id=sa) <> 5 then raise exception 'final balance'; end if;
end $$;
