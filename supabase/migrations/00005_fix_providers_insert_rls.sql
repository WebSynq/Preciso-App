-- Migration: 00005_fix_providers_insert_rls
--
-- Problem:
--   The original providers_insert_service policy used WITH CHECK (true),
--   which allowed any authenticated user (not just the service role) to insert
--   a providers row with an arbitrary id — including someone else's user ID.
--
-- Fix:
--   Replace it with a policy that constrains the inserted id to match the
--   authenticated user's id (auth.uid()). This ensures each user can only
--   ever create their own provider record.
--
--   The service role still bypasses RLS entirely (Supabase default), so
--   admin/system inserts via service role are unaffected.

DROP POLICY IF EXISTS "providers_insert_service" ON providers;

CREATE POLICY "providers_insert_own"
  ON providers
  FOR INSERT
  WITH CHECK (id = auth.uid());
