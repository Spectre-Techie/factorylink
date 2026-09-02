import test from 'node:test';
import assert from 'node:assert/strict';

import { InventoryService } from './inventoryService.js';
import { createInventoryRepository } from './inventoryRepository.js';

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const repository = {
    listInventoryItems: async () => [
      {
        id: 'item-1',
        organization_id: 'org-1',
        sku: 'BOLT-01',
        name: 'Bolt Kit',
        quantity_available: 3,
        reorder_threshold: 5,
        unit: 'pcs',
        status: 'active',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ],
    getInventoryItemById: async () => null,
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (id: string, quantity: number) => ({ id, quantity_available: quantity }),
    listContacts: async () => [
      {
        id: 'contact-1',
        organization_id: 'org-1',
        name: 'Ops Lead',
        phone_number: '+254712345678',
        channel: 'sms',
        status: 'active',
      },
    ],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => null,
    createAlert: async (payload: Record<string, unknown>) => payload,
    listAuditEventsByItemId: async () => [],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const provider = {
    sendSms: async ({ recipient, message }: { recipient: string; message: string }) => ({
      ok: true,
      provider: 'africastalking',
      type: 'sms',
      message: `Sent to ${recipient}: ${message}`,
    }),
  };

  return new InventoryService(
    ((overrides.repository as typeof repository) ?? repository) as never,
    ((overrides.provider as typeof provider) ?? provider) as never,
  );
}

test('inventory item creation validates required fields', async () => {
  const service = createService();

  await assert.rejects(
    () => service.createInventoryItem({ organization_id: 'org-1', sku: '', name: '', quantity_available: -1, reorder_threshold: -1, unit: '' }, 'org-1'),
    /requires|required/i,
  );
});

test('inventory repository scopes list and detail reads by organization', async () => {
  const repository = createInventoryRepository();

  assert.deepEqual((await repository.listInventoryItems('org-demo')).map((item) => item.organization_id), ['org-demo']);
  assert.equal(await repository.getInventoryItemById('inv-demo-1', 'other-org'), null);
  assert.deepEqual((await repository.listContacts('org-demo')).map((contact) => contact.organization_id), ['org-demo']);
  assert.deepEqual(await repository.listInventoryItems('other-org'), []);
});

test('inventory repository scopes alerts and audit events by organization', async () => {
  const repository = createInventoryRepository();

  assert.deepEqual(await repository.listAlerts('org-demo'), []);
  assert.equal(await repository.getRecentAlert('inv-demo-1', 'other-org'), null);
  assert.deepEqual(await repository.listAuditEventsByItemId('inv-demo-1', 'other-org'), []);
});

test('low-stock detection uses the reorder threshold as the trigger boundary', () => {
  const service = createService();

  assert.equal(service.isLowStock({ quantity_available: 5, reorder_threshold: 5 }), true);
  assert.equal(service.isLowStock({ quantity_available: 6, reorder_threshold: 5 }), false);
});

test('triggering alerts skips duplicate messages within the cool-down window', async () => {
  let sendCalls = 0;
  const repository = {
    listInventoryItems: async () => [{
      id: 'item-1',
      organization_id: 'org-1',
      sku: 'BOLT-01',
      name: 'Bolt Kit',
      quantity_available: 3,
      reorder_threshold: 5,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }],
    getInventoryItemById: async () => null,
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (id: string, quantity: number) => ({ id, quantity_available: quantity }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => ({
      id: 'alert-1',
      inventory_item_id: 'item-1',
      alert_type: 'low_stock',
      created_at: new Date().toISOString(),
    }),
    createAlert: async (payload: Record<string, unknown>) => payload,
    listAuditEventsByItemId: async () => [],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const provider = {
    sendSms: async () => {
      sendCalls += 1;
      return { ok: true, provider: 'africastalking', type: 'sms', message: 'sent' };
    },
  };

  const service = new InventoryService(repository as never, provider as never);
  const result = await service.triggerLowStockAlerts('org-1');

  assert.equal(sendCalls, 0);
  assert.equal(result.processed, 0);
  assert.equal(result.skipped, 1);
});

test('quantity update below threshold automatically triggers the low-stock workflow', async () => {
  let smsCalls = 0;
  const provider = {
    sendSms: async () => {
      smsCalls += 1;
      return { ok: true, provider: 'africastalking', type: 'sms', message: 'sent' };
    },
  };

  const repository = {
    listInventoryItems: async () => [{
      id: 'item-3',
      organization_id: 'org-1',
      sku: 'SCREW-02',
      name: 'Screw Pack',
      quantity_available: 25,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }],
    getInventoryItemById: async () => ({
      id: 'item-3',
      organization_id: 'org-1',
      sku: 'SCREW-02',
      name: 'Screw Pack',
      quantity_available: 25,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (_id: string, quantity: number) => ({
      id: 'item-3',
      organization_id: 'org-1',
      sku: 'SCREW-02',
      name: 'Screw Pack',
      quantity_available: quantity,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-02T00:00:00.000Z',
    }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => null,
    createAlert: async (payload: Record<string, unknown>) => ({
      id: 'alert-3',
      organization_id: 'org-1',
      inventory_item_id: 'item-3',
      alert_type: 'low_stock',
      status: 'sent',
      message: String(payload.message ?? ''),
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    listAuditEventsByItemId: async () => [],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const service = new InventoryService(repository as never, provider as never);
  const item = await service.updateInventoryQuantity('item-3', 15, 'org-1');

  assert.equal(item.quantity_available, 15);
  assert.equal(smsCalls, 1);
});

test('quantity update above threshold does not trigger an alert', async () => {
  let smsCalls = 0;
  const provider = {
    sendSms: async () => {
      smsCalls += 1;
      return { ok: true, provider: 'africastalking', type: 'sms', message: 'sent' };
    },
  };

  const repository = {
    listInventoryItems: async () => [{
      id: 'item-4',
      organization_id: 'org-1',
      sku: 'SCREW-03',
      name: 'Screw Pack',
      quantity_available: 25,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }],
    getInventoryItemById: async () => ({
      id: 'item-4',
      organization_id: 'org-1',
      sku: 'SCREW-03',
      name: 'Screw Pack',
      quantity_available: 25,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (_id: string, quantity: number) => ({
      id: 'item-4',
      organization_id: 'org-1',
      sku: 'SCREW-03',
      name: 'Screw Pack',
      quantity_available: quantity,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-02T00:00:00.000Z',
    }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => null,
    createAlert: async (payload: Record<string, unknown>) => ({
      id: 'alert-4',
      organization_id: 'org-1',
      inventory_item_id: 'item-4',
      alert_type: 'low_stock',
      status: 'sent',
      message: String(payload.message ?? ''),
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    listAuditEventsByItemId: async () => [],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const service = new InventoryService(repository as never, provider as never);
  await service.updateInventoryQuantity('item-4', 25, 'org-1');

  assert.equal(smsCalls, 0);
});

test('continuously low stock does not generate duplicate alerts within the suppression window', async () => {
  let smsCalls = 0;
  const provider = {
    sendSms: async () => {
      smsCalls += 1;
      return { ok: true, provider: 'africastalking', type: 'sms', message: 'sent' };
    },
  };

  const repository = {
    listInventoryItems: async () => [{
      id: 'item-5',
      organization_id: 'org-1',
      sku: 'NUT-01',
      name: 'Nut Pack',
      quantity_available: 15,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-01T00:00:00.000Z',
    }],
    getInventoryItemById: async () => ({
      id: 'item-5',
      organization_id: 'org-1',
      sku: 'NUT-01',
      name: 'Nut Pack',
      quantity_available: 15,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (_id: string, quantity: number) => ({
      id: 'item-5',
      organization_id: 'org-1',
      sku: 'NUT-01',
      name: 'Nut Pack',
      quantity_available: quantity,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-02T00:00:00.000Z',
    }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => ({
      id: 'alert-5',
      organization_id: 'org-1',
      inventory_item_id: 'item-5',
      alert_type: 'low_stock',
      status: 'sent',
      message: 'Low stock alert',
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    createAlert: async (payload: Record<string, unknown>) => ({
      id: 'alert-5-bis',
      organization_id: 'org-1',
      inventory_item_id: 'item-5',
      alert_type: 'low_stock',
      status: 'sent',
      message: String(payload.message ?? ''),
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    listAuditEventsByItemId: async () => [{
      id: 'audit-5',
      organization_id: 'org-1',
      inventory_item_id: 'item-5',
      event_type: 'inventory_status_changed',
      details: { new_status: 'low_stock' },
      created_at: '2025-01-01T00:00:00.000Z',
    }],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const service = new InventoryService(repository as never, provider as never);
  const result = await service.triggerLowStockAlerts('org-1');

  assert.equal(result.processed, 0);
  assert.equal(result.skipped, 1);
  assert.equal(smsCalls, 0);
});

test('recovery above threshold followed by another drop below threshold generates a new alert', async () => {
  let smsCalls = 0;
  const provider = {
    sendSms: async () => {
      smsCalls += 1;
      return { ok: true, provider: 'africastalking', type: 'sms', message: 'sent' };
    },
  };

  const repository = {
    listInventoryItems: async () => [{
      id: 'item-6',
      organization_id: 'org-1',
      sku: 'RIVET-01',
      name: 'Rivet Box',
      quantity_available: 15,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-03T00:00:00.000Z',
    }],
    getInventoryItemById: async () => ({
      id: 'item-6',
      organization_id: 'org-1',
      sku: 'RIVET-01',
      name: 'Rivet Box',
      quantity_available: 15,
      reorder_threshold: 20,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: '2025-01-03T00:00:00.000Z',
    }),
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (_id: string, quantity: number) => ({
      id: 'item-6',
      organization_id: 'org-1',
      sku: 'RIVET-01',
      name: 'Rivet Box',
      quantity_available: quantity,
      reorder_threshold: 20,
      unit: 'pcs',
      status: quantity <= 20 ? 'low_stock' : 'active',
      updated_at: '2025-01-04T00:00:00.000Z',
    }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => ({
      id: 'alert-6',
      organization_id: 'org-1',
      inventory_item_id: 'item-6',
      alert_type: 'low_stock',
      status: 'sent',
      message: 'Low stock alert',
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    createAlert: async (payload: Record<string, unknown>) => ({
      id: 'alert-6-new',
      organization_id: 'org-1',
      inventory_item_id: 'item-6',
      alert_type: 'low_stock',
      status: 'sent',
      message: String(payload.message ?? ''),
      created_at: '2025-01-03T00:00:00.000Z',
    }),
    listAuditEventsByItemId: async () => [
      { id: 'audit-6a', organization_id: 'org-1', inventory_item_id: 'item-6', event_type: 'inventory_status_changed', details: { new_status: 'low_stock' }, created_at: '2025-01-01T00:00:00.000Z' },
      { id: 'audit-6b', organization_id: 'org-1', inventory_item_id: 'item-6', event_type: 'inventory_status_changed', details: { new_status: 'active' }, created_at: '2025-01-02T00:00:00.000Z' },
      { id: 'audit-6c', organization_id: 'org-1', inventory_item_id: 'item-6', event_type: 'inventory_status_changed', details: { new_status: 'low_stock' }, created_at: '2025-01-03T00:00:00.000Z' },
    ],
    createAuditEvent: async (payload: Record<string, unknown>) => payload,
  };

  const service = new InventoryService(repository as never, provider as never);
  const result = await service.triggerLowStockAlerts('org-1');

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 0);
  assert.equal(smsCalls, 1);
});

test('invalid quantity is rejected', async () => {
  const service = createService();

  await assert.rejects(() => service.updateInventoryQuantity('item-1', -1, 'org-1'), /non-negative/i);
});

test('invalid threshold is rejected', async () => {
  const service = createService();

  await assert.rejects(
    () => service.createInventoryItem({ organization_id: 'org-1', sku: 'RING-09', name: 'Ring', quantity_available: 10, reorder_threshold: -1, unit: 'pcs' }, 'org-1'),
    /reorder_threshold/i,
  );
});

test('provider failures are recorded as failed alert events without crashing the workflow', async () => {
  let auditEvents = 0;
  const provider = {
    sendSms: async () => ({ ok: false, provider: 'africastalking', type: 'sms', message: 'Provider rejected request' }),
  };

  const repository = {
    listInventoryItems: async () => [{
      id: 'item-2',
      organization_id: 'org-1',
      sku: 'LENS-01',
      name: 'Lens',
      quantity_available: 1,
      reorder_threshold: 5,
      unit: 'pcs',
      status: 'active',
      updated_at: '2025-01-01T00:00:00.000Z',
    }],
    getInventoryItemById: async () => null,
    createInventoryItem: async (payload: Record<string, unknown>) => payload,
    updateInventoryQuantity: async (id: string, quantity: number) => ({ id, quantity_available: quantity }),
    listContacts: async () => [{
      id: 'contact-1',
      organization_id: 'org-1',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
    }],
    createContact: async (payload: Record<string, unknown>) => payload,
    listAlerts: async () => [],
    getRecentAlert: async () => null,
    createAlert: async (payload: Record<string, unknown>) => ({
      id: 'alert-2',
      organization_id: 'org-1',
      inventory_item_id: 'item-2',
      alert_type: 'low_stock',
      status: 'failed',
      message: String(payload.message ?? ''),
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    listAuditEventsByItemId: async () => [],
    createAuditEvent: async (payload: Record<string, unknown>) => {
      auditEvents += 1;
      return payload as Record<string, unknown>;
    },
  };

  const service = new InventoryService(repository as never, provider as never);
  const result = await service.triggerLowStockAlerts('org-1');

  assert.equal(result.processed, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].status, 'failed');
  assert.equal(auditEvents, 1);
});
