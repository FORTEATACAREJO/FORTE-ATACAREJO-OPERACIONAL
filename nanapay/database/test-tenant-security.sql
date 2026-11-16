-- Isolated test DB only. This is never run against FORTE project databases.
BEGIN;
DO $$
DECLARE name text; checked integer:=0;
BEGIN
 FOREACH name IN ARRAY ARRAY[
 'nanapay_restaurants','nanapay_staff','nanapay_tables','nanapay_accounts',
 'nanapay_guests','nanapay_items','nanapay_returns','nanapay_orders',
 'nanapay_payments','nanapay_audit_events','nanapay_licenses'
 ] LOOP
  IF NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=name AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'RLS absent for %', name; END IF;
  IF has_table_privilege('anon','public.'||name,'SELECT')
    OR has_table_privilege('authenticated','public.'||name,'SELECT')
    OR has_table_privilege('anon','public.'||name,'INSERT')
    OR has_table_privilege('authenticated','public.'||name,'UPDATE')
  THEN RAISE EXCEPTION 'Public privileges on %', name; END IF;
  checked:=checked+1;
 END LOOP;
 IF checked<>11 THEN RAISE EXCEPTION 'Unexpected table count'; END IF;
 IF NOT has_table_privilege('service_role','public.nanapay_restaurants','SELECT')
  THEN RAISE EXCEPTION 'Server role denied'; END IF;
 IF has_table_privilege('service_role','public.nanapay_audit_events','UPDATE')
  THEN RAISE EXCEPTION 'Audit must be append-only'; END IF;
END $$;
-- Validate that one restaurant cannot attach another tenant's foreign key.
DO $$
DECLARE ra uuid;rb uuid; ta uuid;tb uuid; a1 uuid;a2 uuid;g1 uuid;
BEGIN
 INSERT INTO public.nanapay_restaurants(name) VALUES('Teste A') RETURNING id INTO ra;
 INSERT INTO public.nanapay_restaurants(name) VALUES('Teste B') RETURNING id INTO rb;
 INSERT INTO public.nanapay_tables(restaurant_id,table_number) VALUES(ra,'12') RETURNING id INTO ta;
 INSERT INTO public.nanapay_tables(restaurant_id,table_number) VALUES(rb,'12') RETURNING id INTO tb;
 INSERT INTO public.nanapay_accounts(restaurant_id,table_id) VALUES(ra,ta) RETURNING id INTO a1;
 INSERT INTO public.nanapay_accounts(restaurant_id,table_id) VALUES(rb,tb) RETURNING id INTO a2;
 INSERT INTO public.nanapay_guests(restaurant_id,account_id,display_name,session_token_digest)
  VALUES(ra,a1,'Pessoa Teste',repeat('a',64)) RETURNING id INTO g1;
 BEGIN
  INSERT INTO public.nanapay_items(restaurant_id,account_id,guest_id,product_name,quantity,unit_cents)
    VALUES(rb,a2,g1,'Teste invasor',1,100);
  RAISE EXCEPTION 'Tenant crossing was not rejected';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.nanapay_items(restaurant_id,account_id,guest_id,product_name,quantity,unit_cents)
  VALUES(ra,a1,g1,'Produto válido',1,100);
END $$;
ROLLBACK;
