import test from 'node:test';
import assert from 'node:assert/strict';

import { SmsInboundService } from './smsInboundService.js';

test('Africa\'s Talking official inbound SMS callback contract', async () => {
  const distributorPhoneNumber = '+2349079644972';
  const distributorOrgId = '11111111-1111-4111-8111-111111111111';

  const service = new SmsInboundService({
    repository: {
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
    },
    lookupSenderByPhone: async (phoneNumber: string) => {
      if (phoneNumber === distributorPhoneNumber) {
        return {
          id: 'distributor-123',
          organization_id: distributorOrgId,
        };
      }
      return null;
    },
  });

  // Test 1: `from` field maps to phone_number
  const test1 = await service.processIncomingMessage({
    from: '+254712345001',
    text: 'Test message 1',
    to: '3979',
    id: 'at-1001',
    date: '2026-09-02 10:00:00',
    linkId: 'link-1001',
  });

  assert.equal(test1.accepted, true, 'Message should be accepted');
  assert.equal(test1.record?.phone_number, '+254712345001', 'from field should map to phone_number');
  assert.equal(test1.record?.message, 'Test message 1', 'text should be captured');
  assert.equal(test1.record?.shortcode, '3979', 'to should map to shortcode');
  assert.equal(test1.record?.provider_message_id, 'at-1001', 'id should map to provider_message_id');
  assert.equal(test1.record?.link_id, 'link-1001', 'linkId should be captured');
  assert.equal(test1.record?.sender_kind, 'unknown', 'unknown sender should be marked as unknown');
  assert.equal(test1.record?.organization_id, null, 'unknown sender should have NULL organization_id');

  // Test 2: Known distributor phone number resolves to correct organization
  const test2 = await service.processIncomingMessage({
    from: distributorPhoneNumber,
    text: 'Order inquiry',
    to: '3979',
    id: 'at-2001',
    date: '2026-09-02 10:01:00',
    linkId: 'link-2001',
  });

  assert.equal(test2.accepted, true, 'Message should be accepted');
  assert.equal(test2.record?.phone_number, distributorPhoneNumber, 'Known distributor phone should be captured');
  assert.equal(test2.record?.sender_kind, 'known', 'Known distributor should be marked as known');
  assert.equal(test2.record?.organization_id, distributorOrgId, 'Known distributor should resolve to correct organization');

  // Test 3: Cost field present does not break processing
  const test3 = await service.processIncomingMessage({
    from: '+254700000555',
    text: 'Test with cost',
    to: '3979',
    id: 'at-3001',
    date: '2026-09-02 10:02:00',
    linkId: 'link-3001',
    cost: '0.50',
  });

  assert.equal(test3.accepted, true, 'Message with cost should be accepted');
  assert.equal(test3.record?.message, 'Test with cost', 'Message should be captured even when cost is present');
  assert.equal(test3.record?.sender_kind, 'unknown', 'Unknown sender with cost should work');

  // Test 4: Duplicate provider ID remains deduplicated
  const dupRepo = {
    findByProviderMessageId: async (providerMessageId: string) =>
      providerMessageId === 'at-dup-001'
        ? {
            id: 'existing-id',
            phone_number: '+254712345678',
            message: 'Original message',
            shortcode: '3979',
            provider_message_id: 'at-dup-001',
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

  const dupService = new SmsInboundService({ repository: dupRepo });
  const test4 = await dupService.processIncomingMessage({
    from: '+254712345678',
    text: 'Duplicate message',
    to: '3979',
    id: 'at-dup-001',
    date: '2026-09-02 10:03:00',
    linkId: 'link-4001',
  });

  assert.equal(test4.accepted, true, 'Duplicate should be accepted (acknowledged)');
  assert.equal(test4.duplicate, true, 'Duplicate flag should be true');
  assert.equal(test4.reason, 'Duplicate inbound SMS callback ignored.', 'Should report duplicate reason');

  // Test 5: phoneNumber fallback still works (backward compat)
  const test5 = await service.processIncomingMessage({
    phoneNumber: '+254788888888',
    text: 'Legacy format',
    to: '3979',
    id: 'at-5001',
  });

  assert.equal(test5.accepted, true, 'Legacy phoneNumber should still work');
  assert.equal(test5.record?.phone_number, '+254788888888', 'phoneNumber fallback should be used when from is missing');
});
