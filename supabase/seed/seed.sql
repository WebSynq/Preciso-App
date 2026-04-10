-- seed.sql
-- Test seed data for local development only
-- WARNING: Never run in production. Uses deterministic UUIDs for testing.

-- Test provider (individual clinician)
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

-- Test provider (hospital admin — pending)
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
