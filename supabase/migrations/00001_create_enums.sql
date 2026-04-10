-- 00001_create_enums.sql
-- Create all enum types for the PRECISO platform

CREATE TYPE account_type AS ENUM ('individual_clinician', 'hospital_admin');

CREATE TYPE phin_status AS ENUM ('pending', 'active', 'suspended');

CREATE TYPE panel_type AS ENUM ('newborn', 'pediatric', 'adult', 'senior');

CREATE TYPE order_status AS ENUM (
  'pending',
  'submitted',
  'fulfilled',
  'in_transit',
  'delivered',
  'specimen_collected',
  'at_lab',
  'sequencing',
  'resulted',
  'report_ready',
  'cancelled'
);

CREATE TYPE lab_partner AS ENUM ('cenegenics', 'sampled');

CREATE TYPE result_status AS ENUM ('pending', 'processing', 'complete', 'flagged', 'failed');

CREATE TYPE custody_event_type AS ENUM (
  'ordered',
  'kit_shipped',
  'kit_delivered',
  'specimen_collected',
  'specimen_shipped',
  'lab_received',
  'sequencing_started',
  'sequencing_complete',
  'result_uploaded'
);

CREATE TYPE actor_type AS ENUM ('provider', 'system', 'admin');
