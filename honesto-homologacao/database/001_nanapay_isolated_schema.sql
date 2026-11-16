-- NANAPAY / PRIVACIDADE E SEGURANÇA / v1 / 2026-11-16
-- Preparação para projeto Supabase EXCLUSIVO (não executar nos projetos FORTE).
-- NÃO libera endpoints públicos, nem autoriza pagamentos reais.
BEGIN;
CREATE TABLE IF NOT EXISTS public.nanapay_restaurants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 100),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 ordering_enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.nanapay_staff (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.nanapay_restaurants(id) ON DELETE RESTRICT,
 auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 2 AND 80),
 role text NOT NULL CHECK(role IN ('admin','garcom')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 UNIQUE(restaurant_id,auth_user_id),
 UNIQUE(id,restaurant_id)
);
CREATE TABLE IF NOT EXISTS public.nanapay_tables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.nanapay_restaurants(id) ON DELETE RESTRICT,
 table_number text NOT NULL CHECK(table_number ~ '^[A-Za-z0-9]{1,6}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(restaurant_id,table_number),
 UNIQUE(id,restaurant_id)
);
CREATE TABLE IF NOT EXISTS public.nanapay_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.nanapay_restaurants(id) ON DELETE RESTRICT,
 table_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','settled','cancelled')),
 opened_at timestamptz NOT NULL DEFAULT now(),
 settled_at timestamptz,
 pos_check_ref text,
 UNIQUE(id,restaurant_id),
 CONSTRAINT nanapay_accounts_table_tenant FOREIGN KEY(table_id,restaurant_id)
   REFERENCES public.nanapay_tables(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_accounts_settled_time CHECK(state <> 'settled' OR settled_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_one_open_account_per_table
 ON public.nanapay_accounts(restaurant_id,table_id) WHERE state='open';
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_pos_check_ref_unique
 ON public.nanapay_accounts(restaurant_id,pos_check_ref) WHERE pos_check_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.nanapay_guests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 2 AND 60),
 -- Never store a raw client token in the database.
 session_token_digest text NOT NULL CHECK(char_length(session_token_digest)=64),
 joined_at timestamptz NOT NULL DEFAULT now(),
 left_at timestamptz,
 service_opt_in boolean NOT NULL DEFAULT false,
 UNIQUE(id,restaurant_id),
 UNIQUE(restaurant_id,session_token_digest),
 CONSTRAINT nanapay_guests_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.nanapay_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 guest_id uuid,
 product_name text NOT NULL CHECK(char_length(btrim(product_name)) BETWEEN 2 AND 120),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
 unit_cents integer NOT NULL CHECK(unit_cents BETWEEN 0 AND 100000000),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled')),
 pos_item_ref text,
 launched_at timestamptz NOT NULL DEFAULT now(),
 cancelled_at timestamptz,
 UNIQUE(id,restaurant_id),
 CONSTRAINT nanapay_item_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_item_guest_tenant FOREIGN KEY(guest_id,restaurant_id)
   REFERENCES public.nanapay_guests(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_item_cancel_time CHECK(state <> 'cancelled' OR cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_item_pos_unique
 ON public.nanapay_items(restaurant_id,pos_item_ref) WHERE pos_item_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.nanapay_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 item_id uuid NOT NULL,
 guest_id uuid NOT NULL,
 request_reason text NOT NULL CHECK(char_length(btrim(request_reason)) BETWEEN 5 AND 300),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
 decision_reason text,
 pos_decision_ref text,
 requested_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 UNIQUE(id,restaurant_id),
 CONSTRAINT nanapay_return_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_return_item_tenant FOREIGN KEY(item_id,restaurant_id)
   REFERENCES public.nanapay_items(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_return_guest_tenant FOREIGN KEY(guest_id,restaurant_id)
   REFERENCES public.nanapay_guests(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_return_decision_time CHECK(status='pending' OR decided_at IS NOT NULL),
 CONSTRAINT nanapay_return_denied_reason CHECK(status<>'denied' OR char_length(btrim(coalesce(decision_reason,'')))>=5)
);
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_return_one_pending
 ON public.nanapay_returns(restaurant_id,item_id) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_pos_decision_once
 ON public.nanapay_returns(restaurant_id,pos_decision_ref) WHERE pos_decision_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.nanapay_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 guest_id uuid NOT NULL,
 request_id uuid NOT NULL,
 product_name text NOT NULL CHECK(char_length(btrim(product_name)) BETWEEN 2 AND 120),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 unit_cents integer NOT NULL CHECK(unit_cents BETWEEN 0 AND 100000000),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','accepted','rejected','delivered')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(restaurant_id,request_id),
 UNIQUE(id,restaurant_id),
 CONSTRAINT nanapay_order_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_order_guest_tenant FOREIGN KEY(guest_id,restaurant_id)
   REFERENCES public.nanapay_guests(id,restaurant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.nanapay_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 guest_id uuid,
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 method text NOT NULL CHECK(method IN ('pix','card','cash','other')),
 status text NOT NULL CHECK(status IN ('confirmed','reversed')),
 pos_payment_ref text NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 reversed_at timestamptz,
 UNIQUE(restaurant_id,pos_payment_ref),
 UNIQUE(id,restaurant_id),
 CONSTRAINT nanapay_payment_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT,
 CONSTRAINT nanapay_payment_guest_tenant FOREIGN KEY(guest_id,restaurant_id)
   REFERENCES public.nanapay_guests(id,restaurant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.nanapay_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES public.nanapay_restaurants(id) ON DELETE RESTRICT,
 account_id uuid,
 actor_type text NOT NULL CHECK(actor_type IN ('client','admin','waiter','pos','system')),
 event_type text NOT NULL CHECK(char_length(btrim(event_type)) BETWEEN 2 AND 90),
 event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 request_id uuid,
 CONSTRAINT nanapay_audit_account_tenant FOREIGN KEY(account_id,restaurant_id)
   REFERENCES public.nanapay_accounts(id,restaurant_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS nanapay_audit_request_once
 ON public.nanapay_audit_events(restaurant_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nanapay_audit_replay ON public.nanapay_audit_events(restaurant_id,account_id,occurred_at,id);
CREATE TABLE IF NOT EXISTS public.nanapay_licenses (
 restaurant_id uuid PRIMARY KEY REFERENCES public.nanapay_restaurants(id) ON DELETE RESTRICT,
 monthly_cents integer NOT NULL DEFAULT 499 CHECK(monthly_cents=499),
 status text NOT NULL DEFAULT 'not_configured'
    CHECK(status IN ('not_configured','trial','active','past_due','cancelled')),
 -- Only gateway token/reference; never store raw card number or CVV.
 gateway_customer_ref text,
 gateway_subscription_ref text,
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- Block direct reads/writes from both public roles. Backend must authenticate
-- each user, authorize tenant+role, then use server-only credentials.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'nanapay_restaurants','nanapay_staff','nanapay_tables','nanapay_accounts',
  'nanapay_guests','nanapay_items','nanapay_returns','nanapay_orders',
  'nanapay_payments','nanapay_audit_events','nanapay_licenses'
 ] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
 END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.nanapay_audit_events_id_seq FROM anon, authenticated, PUBLIC;
COMMIT;
