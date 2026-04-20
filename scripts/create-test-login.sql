-- create-test-login.sql
-- One-shot script to create a doctor portal test login against an already-
-- running Supabase instance (skips a full `supabase db reset`).
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/create-test-login.sql
--
-- Creates:
--   dr.testclinician@example.com  /  PrecisoTest123!   (active clinician)
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING on every insert.

-- 1) Auth user ---------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'dr.testclinician@example.com',
  crypt('PrecisoTest123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Jane","last_name":"Doe","account_type":"individual_clinician"}',
  NOW(), NOW(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- 2) Email identity ----------------------------------------------------------
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'email', 'dr.testclinician@example.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(), NOW(), NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 3) Provider profile (id must equal auth.users.id for RLS) ------------------
INSERT INTO providers (
  id, email, npi_number, first_name, last_name,
  organization, account_type, phin_status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dr.testclinician@example.com',
  '1234567890',
  'Jane', 'Doe',
  'Doe Family Practice',
  'individual_clinician',
  'active'
)
ON CONFLICT (id) DO NOTHING;
