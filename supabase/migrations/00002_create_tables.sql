-- 00002_create_tables.sql
-- Create all core tables for the PRECISO platform

-- ─── Helper: auto-update updated_at timestamp ────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── providers ───────────────────────────────────────────────────────────────

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  npi_number TEXT,
  first_name TEXT,
  last_name TEXT,
  organization TEXT,
  account_type account_type NOT NULL DEFAULT 'individual_clinician',
  phin_status phin_status NOT NULL DEFAULT 'pending',
  ghl_contact_id TEXT,
  vericense_identity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_providers_email ON providers (email);
CREATE INDEX idx_providers_npi ON providers (npi_number) WHERE npi_number IS NOT NULL;
CREATE INDEX idx_providers_ghl_contact ON providers (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;

-- ─── kit_orders ──────────────────────────────────────────────────────────────

CREATE TABLE kit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  patient_ref TEXT,
  panel_type panel_type NOT NULL,
  order_status order_status NOT NULL DEFAULT 'pending',
  firstsource_order_id TEXT,
  kit_barcode TEXT,
  tracking_number TEXT,
  delivery_address JSONB,
  ghl_opportunity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_kit_orders_updated_at
  BEFORE UPDATE ON kit_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_kit_orders_provider ON kit_orders (provider_id);
CREATE INDEX idx_kit_orders_status ON kit_orders (order_status);
CREATE INDEX idx_kit_orders_barcode ON kit_orders (kit_barcode) WHERE kit_barcode IS NOT NULL;
CREATE INDEX idx_kit_orders_tracking ON kit_orders (tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_kit_orders_firstsource ON kit_orders (firstsource_order_id) WHERE firstsource_order_id IS NOT NULL;

-- ─── lab_results ─────────────────────────────────────────────────────────────

CREATE TABLE lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_order_id UUID NOT NULL REFERENCES kit_orders(id) ON DELETE RESTRICT,
  lab_partner lab_partner NOT NULL,
  result_status result_status NOT NULL DEFAULT 'pending',
  result_received_at TIMESTAMPTZ,
  report_url TEXT,
  raw_result_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_results_kit_order ON lab_results (kit_order_id);
CREATE INDEX idx_lab_results_status ON lab_results (result_status);

-- ─── custody_events ──────────────────────────────────────────────────────────

CREATE TABLE custody_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_order_id UUID NOT NULL REFERENCES kit_orders(id) ON DELETE RESTRICT,
  event_type custody_event_type NOT NULL,
  scanned_by TEXT,
  location TEXT,
  barcode TEXT,
  vericense_audit_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custody_events_kit_order ON custody_events (kit_order_id);
CREATE INDEX idx_custody_events_barcode ON custody_events (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_custody_events_type ON custody_events (event_type);

-- ─── audit_logs ──────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_type actor_type NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at);
