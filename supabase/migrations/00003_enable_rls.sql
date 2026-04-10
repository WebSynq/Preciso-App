-- 00003_enable_rls.sql
-- Enable Row Level Security and create policies for all tables
-- Supabase auth.uid() returns the authenticated user's ID (matches providers.id)

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── providers: users can only read/update their own record ──────────────────

CREATE POLICY "providers_select_own"
  ON providers
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "providers_update_own"
  ON providers
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert is handled by service role during registration (not user-facing)
CREATE POLICY "providers_insert_service"
  ON providers
  FOR INSERT
  WITH CHECK (true);
  -- Service role bypasses RLS; this policy exists for completeness

-- ─── kit_orders: providers can only see their own orders ─────────────────────

CREATE POLICY "kit_orders_select_own"
  ON kit_orders
  FOR SELECT
  USING (provider_id = auth.uid());

CREATE POLICY "kit_orders_insert_own"
  ON kit_orders
  FOR INSERT
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "kit_orders_update_own"
  ON kit_orders
  FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

-- ─── lab_results: providers can only see results linked to their orders ──────

CREATE POLICY "lab_results_select_own"
  ON lab_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kit_orders
      WHERE kit_orders.id = lab_results.kit_order_id
        AND kit_orders.provider_id = auth.uid()
    )
  );

-- Insert/update handled by service role (system writes from webhooks)

-- ─── custody_events: read-only for providers, system-write only ──────────────

CREATE POLICY "custody_events_select_own"
  ON custody_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kit_orders
      WHERE kit_orders.id = custody_events.kit_order_id
        AND kit_orders.provider_id = auth.uid()
    )
  );

-- Insert handled by service role only (barcode scans, webhooks)

-- ─── audit_logs: read-only for admins, system-write only ─────────────────────
-- Admin role check uses a custom claim on the JWT: app_metadata.role = 'admin'

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
  );

-- Insert handled by service role only (all audit writes go through the API)
