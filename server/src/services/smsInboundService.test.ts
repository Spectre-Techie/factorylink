import test from 'node:test';
import assert from 'node:assert/strict';

import { SmsInboundService } from './smsInboundService.js';

test('accepts a valid Africa\'s Talking inbound SMS callback', async () => {
  const service = new SmsInboundService({
    findByProviderMessageId: async () => null,
    create: async (record) => ({
      ...record,
      id: record.id ?? 'generated-id',
      created_at: record.created_at ?? new Date().toISOString(),
      shortcode: record.shortcode ?? null,
      provider_message_id: record.provider_message_id ?? null,
      link_id: record.link_id ?? null,
      direction: 'inbound',
      status: 'received',
      sender_kind: record.sender_kind,
      organization_id: record.organization_id ?? null,
    }),
  });

  const result = await service.processIncomingMessage({
    phoneNumber: '+254712345678',
    text: 'Hello FactoryLink',
    date: '2026-09-01 10:00:00',
    id: 'at-msg-1',
    to: '+254700000123',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.record?.phone_number, '+254712345678');
  assert.equal(result.record?.message, 'Hello FactoryLink');
  assert.equal(result.record?.provider_message_id, 'at-msg-1');
});

test('rejects a malformed payload without creating a record', async () => {
  const service = new SmsInboundService({
    findByProviderMessageId: async () => null,
    create: async () => {
      throw new Error('should not persist');
    },
  });

  const result = await service.processIncomingMessage({
    phoneNumber: 'bad-phone',
    text: 'hello',
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'Invalid inbound SMS payload.');
});

test('rejects a missing phone number or message', async () => {
  const service = new SmsInboundService({
    findByProviderMessageId: async () => null,
    create: async () => {
      throw new Error('should not persist');
    },
  });

  const missingPhone = await service.processIncomingMessage({ text: 'hello' });
  const missingMessage = await service.processIncomingMessage({ phoneNumber: '+254712345678' });

  assert.equal(missingPhone.accepted, false);
  assert.equal(missingMessage.accepted, false);
});

test('treats unknown senders as unknown and still acknowledges callback safely', async () => {
  const service = new SmsInboundService({
    findByProviderMessageId: async () => null,
    create: async (record) => ({
      ...record,
      id: record.id ?? 'generated-id',
      created_at: record.created_at ?? new Date().toISOString(),
      shortcode: record.shortcode ?? null,
      provider_message_id: record.provider_message_id ?? null,
      link_id: record.link_id ?? null,
      direction: 'inbound',
      status: 'received',
      sender_kind: record.sender_kind,
      organization_id: record.organization_id ?? null,
    }),
  });

  const result = await service.processIncomingMessage({
    phoneNumber: '+254700000999',
    text: 'hello',
    date: '2026-09-01 10:00:00',
    id: 'at-msg-unknown',
    to: '+254700000123',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.record?.sender_kind, 'unknown');
});

test('duplicate callback is idempotent when provider message ID repeats', async () => {
  const first = { id: 'at-msg-dup', phoneNumber: '+254712345678', text: 'duplicate', date: '2026-09-01 10:00:00', to: '+254700000123' };
  const repo = {
    findByProviderMessageId: async (providerMessageId: string) => providerMessageId === 'at-msg-dup'
      ? {
          id: 'existing',
          phone_number: '+254712345678',
          message: 'duplicate',
          shortcode: '+254700000123',
          provider_message_id: 'at-msg-dup',
          link_id: null,
          direction: 'inbound' as const,
          status: 'received' as const,
          created_at: new Date().toISOString(),
          sender_kind: 'unknown' as const,
          organization_id: null,
        }
      : null,
    create: async () => {
      throw new Error('duplicate should not be created');
    },
  };

  const service = new SmsInboundService(repo);
  const result = await service.processIncomingMessage(first);

  assert.equal(result.accepted, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.reason, 'Duplicate inbound SMS callback ignored.');
});

test('does not leak secrets in the accepted result payload', async () => {
  const service = new SmsInboundService({
    findByProviderMessageId: async () => null,
    create: async (record) => ({
      ...record,
      id: record.id ?? 'generated-id',
      created_at: record.created_at ?? new Date().toISOString(),
      shortcode: record.shortcode ?? null,
      provider_message_id: record.provider_message_id ?? null,
      link_id: record.link_id ?? null,
      direction: 'inbound',
      status: 'received',
      sender_kind: record.sender_kind,
      organization_id: record.organization_id ?? null,
    }),
  });

  const result = await service.processIncomingMessage({
    phoneNumber: '+254712345678',
    text: 'hello',
    date: '2026-09-01 10:00:00',
    id: 'at-msg-secret',
    to: '+254700000123',
  });

  assert.ok(result.record);
  assert.equal(JSON.stringify(result).includes('apiKey'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
