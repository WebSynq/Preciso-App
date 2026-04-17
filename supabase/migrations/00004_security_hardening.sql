-- 00004_security_hardening.sql
-- HIPAA-aligned security floor applied BEFORE any admin/developer tier ships.
--
-- 1. Make public.audit_logs append-only for every client role (including
--    service_role). RLS policies block UPDATE/DELETE; grants revoke them so
--    service_role (which bypasses RLS) also cannot tamper. Belt + suspenders.
-- 2. Tighten providers_insert policy to self-ID only. The previous policy
--    used WITH CHECK (true) which let any authenticated session insert any
--    provider row. Flagged by Supabase security advisor.
-- 3. Rewrite RLS USING clauses to call (select auth.uid()) / (select
--    auth.jwt()) once per query instead of once per row. Flagged by
--    Supabase performance advisor.
-- 4. Pin search_path = '' on update_updated_at_column trigger function so
--    the function body cannot be shadowed by an untrusted schema in the
--    caller's search_path. Flagged by Supabase security advisor.

-- ─── 1. audit_logs append-only ───────────────────────────────────────────────
-- SECURITY NOTE: Do not weaken these controls. Audit integrity is a HIPAA
-- requirement; UPDATE/DELETE on audit_logs must be impossible from any role.
-- If a legitimate correction is needed, insert a new row that supersedes the
-- prior one — never mutate history in place.

CREATE POLICY "audit_logs_no_update"
  ON public.audit_logs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs
  FOR DELETE
  USING (false);

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated, service_role;

-- ─── 2. providers insert: tighten to self-ID only ────────────────────────────

DROP POLICY IF EXISTS "providers_insert_service" ON public.providers;

CREATE POLICY "providers_insert_self"
  ON public.providers
  FOR INSERT
  WITH CHECK (id = (select auth.uid()));

-- ─── 3. RLS initplan optimisation: (select auth.uid()) / (select auth.jwt())

DROP POLICY IF EXISTS "providers_select_own" ON public.providers;
CREATE POLICY "providers_select_own"
  ON public.providers
  FOR SELECT
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "providers_update_own" ON public.providers;
CREATE POLICY "providers_update_own"
  ON public.providers
  FOR UPDATE
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "kit_orders_select_own" ON public.kit_orders;
CREATE POLICY "kit_orders_select_own"
  ON public.kit_orders
  FOR SELECT
  USING (provider_id = (select auth.uid()));

DROP POLICY IF EXISTS "kit_orders_insert_own" ON public.kit_orders;
CREATE POLICY "kit_orders_insert_own"
  ON public.kit_orders
  FOR INSERT
  WITH CHECK (provider_id = (select auth.uid()));

DROP POLICY IF EXISTS "kit_orders_update_own" ON public.kit_orders;
CREATE POLICY "kit_orders_update_own"
  ON public.kit_orders
  FOR UPDATE
  USING (provider_id = (select auth.uid()))
  WITH CHECK (provider_id = (select auth.uid()));

DROP POLICY IF EXISTS "lab_results_select_own" ON public.lab_results;
CREATE POLICY "lab_results_select_own"
  ON public.lab_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kit_orders
      WHERE kit_orders.id = lab_results.kit_order_id
        AND kit_orders.provider_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "custody_events_select_own" ON public.custody_events;
CREATE POLICY "custody_events_select_own"
  ON public.custody_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kit_orders
      WHERE kit_orders.id = custody_events.kit_order_id
        AND kit_orders.provider_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs
  FOR SELECT
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR
    (((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin'
  );

-- ─── 4. Pin search_path on trigger function ──────────────────────────────────

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
