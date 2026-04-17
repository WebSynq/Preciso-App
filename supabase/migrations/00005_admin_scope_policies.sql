-- 00005_admin_scope_policies.sql
-- Grant READ-ONLY visibility across the platform to users whose JWT carries
-- app_metadata.role = 'admin'. Admin role is assigned by a developer via
-- auth.users.raw_app_meta_data — it is never self-assignable from the app.
--
-- SECURITY NOTE: Admin is READ-ONLY in V1. We intentionally do NOT add
-- admin INSERT / UPDATE / DELETE policies. Write actions ("suspend a
-- provider", "cancel any order") belong in V2 behind MFA + an extra
-- justification audit log.

-- Helper: inline claim check. We do not create a SECURITY DEFINER function
-- because admin check is simple and we don't want to hide RLS logic inside
-- a function body that's harder to audit.

-- ─── providers: admin can read all ───────────────────────────────────────────

CREATE POLICY "providers_select_admin"
  ON public.providers
  FOR SELECT
  USING (
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- ─── kit_orders: admin can read all ──────────────────────────────────────────

CREATE POLICY "kit_orders_select_admin"
  ON public.kit_orders
  FOR SELECT
  USING (
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- ─── lab_results: admin can read all ─────────────────────────────────────────

CREATE POLICY "lab_results_select_admin"
  ON public.lab_results
  FOR SELECT
  USING (
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- ─── custody_events: admin can read all ──────────────────────────────────────

CREATE POLICY "custody_events_select_admin"
  ON public.custody_events
  FOR SELECT
  USING (
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- audit_logs admin read policy was already added in 00003 and preserved
-- through 00004; no change here.
