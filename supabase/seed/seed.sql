-- seed.sql
-- Test seed data for local development only.
-- WARNING: Never run in production. Uses deterministic UUIDs and plaintext
-- passwords. Seed runs as postgres superuser, which bypasses RLS.
--
-- Test logins (created below):
--   dr.testclinician@example.com  /  PrecisoTest123!   (active clinician)
--   admin@testhosp.example.com    /  PrecisoTest123!   (hospital admin, pending)

-- ─── Auth users (Supabase auth schema) ───────────────────────────────────────
-- We insert directly into auth.users + auth.identities so the accounts exist
-- with a real password hash and confirmed email. providers.id must equal
-- auth.users.id for RLS (auth.uid() = providers.id) to work.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'dr.testclinician@example.com',
    crypt('PrecisoTest123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Jane","last_name":"Doe","account_type":"individual_clinician"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'admin@testhosp.example.com',
    crypt('PrecisoTest123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"John","last_name":"Smith","account_type":"hospital_admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

-- auth.identities links the email/password identity to the auth user.
-- provider_id must equal the user's id for the email provider.
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  (
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
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000002',
      'email', 'admin@testhosp.example.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

-- ─── Provider profiles (mirror auth users) ──────────────────────────────────

-- Test provider (individual clinician, active)
INSERT INTO providers (id, email, npi_number, first_name, last_name, organization, account_type, phin_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dr.testclinician@example.com',
  '1234567890',
  'Jane',
  'Doe',
  'Doe Family Practice',
  'individual_clinician',
  'active'
);

-- Test provider (hospital admin, pending)
INSERT INTO providers (id, email, first_name, last_name, organization, account_type, phin_status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@testhosp.example.com',
  'John',
  'Smith',
  'Metro General Hospital',
  'hospital_admin',
  'pending'
);

-- ─── Sample data for the clinician ──────────────────────────────────────────

-- Test kit order for the clinician
INSERT INTO kit_orders (id, provider_id, patient_ref, panel_type, order_status, kit_barcode)
VALUES (
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-000000000001',
  'PAT-2024-001',
  'adult',
  'submitted',
  'KIT-TEST-001'
);

-- Custody event for the test order
INSERT INTO custody_events (id, kit_order_id, event_type, scanned_by, location, barcode)
VALUES (
  '00000000-0000-0000-0000-200000000001',
  '00000000-0000-0000-0000-100000000001',
  'ordered',
  'system',
  'PRECISO Portal',
  'KIT-TEST-001'
);

-- Audit log for the test order
INSERT INTO audit_logs (id, actor_id, actor_type, action, resource_type, resource_id)
VALUES (
  '00000000-0000-0000-0000-300000000001',
  '00000000-0000-0000-0000-000000000001',
  'provider',
  'order.created',
  'kit_orders',
  '00000000-0000-0000-0000-100000000001'
);
