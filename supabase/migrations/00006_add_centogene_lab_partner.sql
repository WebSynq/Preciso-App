-- 00006_add_centogene_lab_partner.sql
-- Adds the 'centogene' value to the lab_partner enum.
--
-- SECURITY / OPERATIONAL NOTE:
--   Postgres enum values cannot be safely removed once a table column
--   uses them, so 'cenegenics' stays in the enum permanently. The
--   codebase is migrated to emit 'centogene' for all new rows; any
--   historical row tagged 'cenegenics' is retained for audit
--   continuity. A future migration can add a CHECK constraint to
--   block new 'cenegenics' inserts if we decide that's warranted.

ALTER TYPE lab_partner ADD VALUE IF NOT EXISTS 'centogene';
