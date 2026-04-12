-- Migration: 00004_idempotency_keys
-- Replaces in-memory idempotency Map with a durable Postgres table.
-- This ensures idempotency keys survive server restarts and work correctly
-- across multiple API instances (ECS tasks, rolling deployments, etc.).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  -- Scoped key: "<user_id>:<client_key>" to prevent cross-user collisions.
  scoped_key   TEXT        PRIMARY KEY,
  status_code  INTEGER     NOT NULL,
  -- Store response body as JSONB for efficient re-serialisation.
  response_body JSONB      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatically delete keys older than 24 hours so the table stays small.
-- In production wire this to pg_cron or a scheduled Lambda instead.
CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON idempotency_keys (created_at);

-- No RLS needed — this table is only accessed via the service role key
-- from the API server, never from a user JWT.
