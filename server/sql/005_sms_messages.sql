CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  shortcode TEXT,
  provider_message_id TEXT,
  link_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('received', 'sent', 'failed')),
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('known', 'unknown')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_messages_provider_message_id ON sms_messages (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_org_created ON sms_messages (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone ON sms_messages (phone_number);
