import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface SmsInboundPayload {
  phoneNumber?: string;
  phone_number?: string;
  from?: string;
  text?: string;
  date?: string;
  id?: string;
  message_id?: string;
  messageId?: string;
  linkId?: string;
  link_id?: string;
  to?: string;
  shortcode?: string;
  cost?: string;
}

export interface KnownSender {
  id: string;
  organization_id: string;
}

export interface SmsInboundRecord {
  id: string;
  phone_number: string;
  message: string;
  shortcode: string | null;
  provider_message_id: string | null;
  link_id: string | null;
  direction: 'inbound';
  status: 'received';
  created_at: string;
  sender_kind: 'known' | 'unknown';
  organization_id: string | null;
}

export interface SmsInboundRepository {
  findByProviderMessageId(providerMessageId: string): Promise<SmsInboundRecord | null>;
  create(record: Omit<SmsInboundRecord, 'id' | 'created_at'> & { id?: string; created_at?: string }): Promise<SmsInboundRecord>;
}

class InMemorySmsInboundRepository implements SmsInboundRepository {
  private readonly records = new Map<string, SmsInboundRecord>();

  async findByProviderMessageId(providerMessageId: string): Promise<SmsInboundRecord | null> {
    return this.records.get(providerMessageId) ?? null;
  }

  async create(record: Omit<SmsInboundRecord, 'id' | 'created_at'> & { id?: string; created_at?: string }): Promise<SmsInboundRecord> {
    const now = new Date().toISOString();
    const normalized: SmsInboundRecord = {
      id: record.id ?? randomUUID(),
      phone_number: record.phone_number,
      message: record.message,
      shortcode: record.shortcode ?? null,
      provider_message_id: record.provider_message_id ?? null,
      link_id: record.link_id ?? null,
      direction: 'inbound',
      status: 'received',
      created_at: record.created_at ?? now,
      sender_kind: record.sender_kind,
      organization_id: record.organization_id ?? null,
    };
    if (normalized.provider_message_id) {
      this.records.set(normalized.provider_message_id, normalized);
    }
    return normalized;
  }
}

export function createSmsInboundRepository(): SmsInboundRepository {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !serviceRoleKey) {
    return new InMemorySmsInboundRepository();
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async findByProviderMessageId(providerMessageId: string) {
      const { data, error } = await supabase.from('sms_messages').select('*').eq('provider_message_id', providerMessageId).maybeSingle();
      if (error) throw new Error(`Failed to load inbound SMS: ${error.message}`);
      return (data as SmsInboundRecord | null) ?? null;
    },
    async create(record) {
      const { data, error } = await supabase.from('sms_messages').insert({
        id: record.id ?? randomUUID(),
        phone_number: record.phone_number,
        message: record.message,
        shortcode: record.shortcode,
        provider_message_id: record.provider_message_id,
        link_id: record.link_id,
        direction: record.direction,
        status: record.status,
        sender_kind: record.sender_kind,
        organization_id: record.organization_id,
      }).select().single();
      if (error) throw new Error(`Failed to persist inbound SMS: ${error.message}`);
      return data as SmsInboundRecord;
    },
  };
}

function redactSmsRecord(record: SmsInboundRecord | null | undefined): SmsInboundRecord | null {
  if (!record) {
    return null;
  }

  const redactIfSensitive = (value: string | null) => {
    if (!value) return value;
    return /secret|api[_-]?key|token|password/i.test(value) ? '[redacted]' : value;
  };

  return {
    ...record,
    provider_message_id: redactIfSensitive(record.provider_message_id),
    link_id: redactIfSensitive(record.link_id),
  };
}

export class SmsInboundService {
  private readonly repository: SmsInboundRepository;
  private readonly lookupSenderByPhone?: (phoneNumber: string) => Promise<KnownSender | null>;

  constructor(
    config: SmsInboundRepository | {
      repository: SmsInboundRepository;
      lookupSenderByPhone?: (phoneNumber: string) => Promise<KnownSender | null>;
    },
  ) {
    if ('repository' in config) {
      this.repository = config.repository;
      this.lookupSenderByPhone = config.lookupSenderByPhone;
      return;
    }

    this.repository = config;
  }

  async processIncomingMessage(payload: SmsInboundPayload): Promise<{ accepted: boolean; duplicate: boolean; reason?: string; record?: SmsInboundRecord | null }> {
    const phoneNumber = (payload.from ?? payload.phoneNumber ?? payload.phone_number ?? '').trim();
    const text = (payload.text ?? '').trim();
    const providerMessageId = (payload.id ?? payload.message_id ?? payload.messageId ?? null)?.trim() || null;
    const shortcode = (payload.to ?? payload.shortcode ?? '').trim() || null;
    const linkId = (payload.linkId ?? payload.link_id ?? '').trim() || null;

    if (!phoneNumber || !/^[+][1-9]\d{7,14}$/.test(phoneNumber.replace(/\s+/g, ''))) {
      return { accepted: false, duplicate: false, reason: 'Invalid inbound SMS payload.' };
    }

    if (!text) {
      return { accepted: false, duplicate: false, reason: 'Invalid inbound SMS payload.' };
    }

    if (providerMessageId) {
      const existing = await this.repository.findByProviderMessageId(providerMessageId);
      if (existing) {
        return { accepted: true, duplicate: true, reason: 'Duplicate inbound SMS callback ignored.', record: redactSmsRecord(existing) };
      }
    }

    const sender = await this.lookupSenderByPhone?.(phoneNumber) ?? null;
    const record = await this.repository.create({
      id: randomUUID(),
      phone_number: phoneNumber,
      message: text,
      shortcode,
      provider_message_id: providerMessageId,
      link_id: linkId,
      direction: 'inbound',
      status: 'received',
      sender_kind: sender ? 'known' : 'unknown',
      organization_id: sender ? sender.organization_id : null,
    });

    return {
      accepted: true,
      duplicate: false,
      reason: 'Inbound SMS callback acknowledged.',
      record: redactSmsRecord(record),
    };
  }
}
