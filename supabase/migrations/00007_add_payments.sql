-- 00007_add_payments.sql
-- Adds payment tracking to kit_orders and a separate payments table
-- for historical ledger queries.
--
-- SECURITY NOTES:
--   - No PHI is stored on the payments table. It holds amounts,
--     Stripe IDs, status, and the link back to kit_orders.id. The
--     provider and order relationship is preserved via FK, not by
--     duplicating identifying fields.
--   - RLS on payments matches kit_orders: providers see their own
--     payments only, admins see all (scoped by app_metadata.role).
--   - INSERT / UPDATE on payments are restricted to the service role
--     path (webhook handler). Providers cannot mutate the ledger.
--   - audit_logs append-only contract continues to cover payment
--     events (see app code for 'payment.*' actions).

-- ─── Payment status enum ─────────────────────────────────────────────────────

CREATE TYPE payment_status AS ENUM (
  'none',          -- no payment attempted (free tier, comp, etc.)
  'pending',       -- PaymentIntent created, awaiting confirmation
  'processing',    -- confirmed, Stripe is processing
  'succeeded',     -- Stripe reports paid
  'failed',        -- card declined or authentication failed
  'refunded',      -- full refund issued
  'disputed',      -- chargeback opened
  'cancelled'      -- cancelled before confirmation
);

-- ─── kit_orders: payment columns ─────────────────────────────────────────────

ALTER TABLE public.kit_orders
  ADD COLUMN payment_status payment_status NOT NULL DEFAULT 'none',
  ADD COLUMN stripe_payment_intent_id TEXT,
  ADD COLUMN amount_cents INTEGER,
  ADD COLUMN currency TEXT DEFAULT 'usd';

CREATE INDEX idx_kit_orders_payment_status
  ON public.kit_orders (payment_status);
CREATE INDEX idx_kit_orders_stripe_payment_intent
  ON public.kit_orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ─── providers: Stripe customer link ─────────────────────────────────────────
-- One Stripe Customer per provider; populated on first payment.

ALTER TABLE public.providers
  ADD COLUMN stripe_customer_id TEXT;

CREATE INDEX idx_providers_stripe_customer
  ON public.providers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ─── payments table (immutable event ledger) ─────────────────────────────────
-- One row per Stripe event we've recorded. Not a cache of kit_orders —
-- a historical ledger so we can reconstruct billing history even if
-- kit_orders is edited.

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_order_id UUID NOT NULL REFERENCES public.kit_orders(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  status payment_status NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  receipt_url TEXT,
  failure_code TEXT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_kit_order ON public.payments (kit_order_id);
CREATE INDEX idx_payments_provider ON public.payments (provider_id);
CREATE INDEX idx_payments_stripe_pi ON public.payments (stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON public.payments (status);
CREATE INDEX idx_payments_created ON public.payments (created_at DESC);

-- ─── RLS on payments ─────────────────────────────────────────────────────────

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Providers see their own payments.
CREATE POLICY "payments_select_own"
  ON public.payments
  FOR SELECT
  USING (provider_id = (select auth.uid()));

-- Admins see all payments.
CREATE POLICY "payments_select_admin"
  ON public.payments
  FOR SELECT
  USING (
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- No INSERT/UPDATE/DELETE policies for user roles — writes happen
-- exclusively from the Stripe webhook handler using the service role.

-- Append-only for everyone (belt + suspenders — service role bypasses
-- RLS, grant-level REVOKE covers it).
CREATE POLICY "payments_no_update"
  ON public.payments
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "payments_no_delete"
  ON public.payments
  FOR DELETE
  USING (false);

REVOKE UPDATE, DELETE, TRUNCATE ON public.payments
  FROM anon, authenticated, service_role;
