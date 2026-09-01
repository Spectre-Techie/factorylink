CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airtime_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES distributor_profiles(id) ON DELETE CASCADE,
  sales_report_id UUID NOT NULL REFERENCES sales_reports(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  provider_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_airtime_rewards_sales_report_id UNIQUE (sales_report_id)
);

CREATE INDEX IF NOT EXISTS idx_airtime_rewards_organization_id
  ON airtime_rewards (organization_id);

CREATE INDEX IF NOT EXISTS idx_airtime_rewards_distributor_id
  ON airtime_rewards (distributor_id);

CREATE INDEX IF NOT EXISTS idx_airtime_rewards_created_at
  ON airtime_rewards (created_at DESC);