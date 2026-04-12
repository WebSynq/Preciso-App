-- 00006_provider_notification_prefs.sql
-- Add notification preference columns to providers table

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS notif_email_order_confirmed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_email_result_ready    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sms_order_confirmed   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_sms_result_ready      BOOLEAN NOT NULL DEFAULT false;
