-- ================================================================
-- Branch Toggler — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- Audit Logs: record every production branch switch
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email     TEXT        NOT NULL,
  user_name      TEXT,
  project_id     TEXT        NOT NULL,
  project_name   TEXT        NOT NULL,
  team_id        TEXT,       -- Added for team context
  from_branch    TEXT        NOT NULL,
  to_branch      TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'success', -- 'success' | 'failed'
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_email_idx  ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS audit_logs_project_id_idx  ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx  ON audit_logs(created_at DESC);

-- Scheduled Switches: future branch switches
CREATE TABLE IF NOT EXISTS scheduled_switches (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email       TEXT        NOT NULL,
  project_id       TEXT        NOT NULL,
  project_name     TEXT        NOT NULL,
  team_id          TEXT,       -- Added for team context
  target_branch    TEXT        NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'executed' | 'failed' | 'cancelled'
  executed_at      TIMESTAMPTZ,
  error_message    TEXT,
  encrypted_token  TEXT,       -- AES-256 encrypted OAuth access token for cron execution
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_switches_user_email_idx ON scheduled_switches(user_email);
CREATE INDEX IF NOT EXISTS scheduled_switches_status_idx     ON scheduled_switches(status);
CREATE INDEX IF NOT EXISTS scheduled_switches_scheduled_at_idx ON scheduled_switches(scheduled_at);

-- Notification Settings: per-user webhook config
CREATE TABLE IF NOT EXISTS notification_settings (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email          TEXT        UNIQUE NOT NULL,
  slack_webhook_url   TEXT,
  discord_webhook_url TEXT,
  notify_on_switch    BOOLEAN     DEFAULT TRUE,
  notify_on_schedule  BOOLEAN     DEFAULT TRUE,
  notify_on_failure   BOOLEAN     DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
