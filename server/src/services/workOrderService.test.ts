import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkOrderService } from './workOrderService.js';

test('valid work order creation succeeds', async () => {
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => null,
    createWorkOrder: async (input: Record<string, unknown>) => ({
      id: 'wo-1',
      organization_id: String(input.organization_id ?? ''),
      site_id: typeof input.site_id === 'string' ? input.site_id : null,
      title: String(input.title ?? ''),
      description: String(input.description ?? ''),
      priority: String(input.priority ?? 'medium') as 'low' | 'medium' | 'high',
      status: String(input.status ?? 'pending') as 'pending' | 'assigned' | 'in_progress' | 'completed',
      created_by_user_id: typeof input.created_by_user_id === 'string' ? input.created_by_user_id : null,
      assigned_to_user_id: typeof input.assigned_to_user_id === 'string' ? input.assigned_to_user_id : null,
      assignee_phone_number: typeof input.assignee_phone_number === 'string' ? input.assignee_phone_number : null,
      due_at: typeof input.due_at === 'string' ? input.due_at : null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    assignWorkOrder: async (id: string, assignee: string, phone?: string | null) => ({
      id,
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: 'assigned',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: assignee,
      assignee_phone_number: phone ?? null,
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    updateWorkOrderStatus: async (id: string, status: string) => ({
      id,
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: status as 'pending' | 'assigned' | 'in_progress' | 'completed',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: 'user-ops',
      assignee_phone_number: '+254712345678',
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createWorkOrderEvent: async (payload: Record<string, unknown>) => payload,
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async (payload) => ({
      ok: true,
      provider: 'africastalking',
      type: 'sms',
      message: String(payload.message ?? ''),
    }),
  });

  const workOrder = await service.createWorkOrder({
    organization_id: 'org-1',
    title: 'Machine inspection',
    description: 'Inspect the machine line',
    priority: 'high',
    created_by_user_id: 'user-creator',
  });

  assert.equal(workOrder.title, 'Machine inspection');
  assert.equal(workOrder.status, 'pending');
});

test('listWorkOrders returns the work order records from the repository', async () => {
  const expected = [{
    id: 'wo-list-1',
    organization_id: 'org-1',
    site_id: null,
    title: 'List check',
    description: 'Ensure list includes the created work order',
    priority: 'high',
    status: 'pending',
    created_by_user_id: 'user-creator',
    assigned_to_user_id: null,
    assignee_phone_number: null,
    due_at: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  }];

  const service = new WorkOrderService({
    listWorkOrders: async () => expected,
    getWorkOrderById: async () => null,
    createWorkOrder: async () => ({}) as never,
    assignWorkOrder: async () => ({}) as never,
    updateWorkOrderStatus: async () => ({}) as never,
    createWorkOrderEvent: async () => ({}) as never,
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: true, provider: 'africastalking', type: 'sms', message: 'sent' }),
  });

  const actual = await service.listWorkOrders();

  assert.ok(Array.isArray(actual));
  assert.equal(actual.length, 1);
  assert.equal(actual[0].id, 'wo-list-1');
  assert.equal(actual[0].organization_id, 'org-1');
});

test('missing required work-order fields are rejected', async () => {
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => null,
    createWorkOrder: async () => ({}) as never,
    assignWorkOrder: async () => ({}) as never,
    updateWorkOrderStatus: async () => ({}) as never,
    createWorkOrderEvent: async () => ({}) as never,
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: true, provider: 'africastalking', type: 'sms', message: 'sent' }),
  });

  await assert.rejects(
    () => service.createWorkOrder({ organization_id: 'org-1', title: '', description: '', priority: 'high' }),
    /title|description/i,
  );
});

test('event creation keeps the real work-order organization_id on every lifecycle event', async () => {
  let createdEvent: Record<string, unknown> | undefined;
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => null,
    createWorkOrder: async (input: Record<string, unknown>) => ({
      id: 'wo-org-test',
      organization_id: String(input.organization_id ?? ''),
      site_id: null,
      title: String(input.title ?? ''),
      description: String(input.description ?? ''),
      priority: String(input.priority ?? 'medium') as 'low' | 'medium' | 'high',
      status: 'pending',
      created_by_user_id: typeof input.created_by_user_id === 'string' ? input.created_by_user_id : null,
      assigned_to_user_id: null,
      assignee_phone_number: null,
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    assignWorkOrder: async () => ({}) as never,
    updateWorkOrderStatus: async () => ({}) as never,
    createWorkOrderEvent: async (payload: Record<string, unknown>) => {
      createdEvent = payload;
      return payload;
    },
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: true, provider: 'africastalking', type: 'sms', message: 'sent' }),
  });

  await service.createWorkOrder({
    organization_id: 'ORG_A',
    title: 'Generator inspection',
    description: 'Check the emergency generator',
    priority: 'high',
    created_by_user_id: 'user-creator',
  });

  assert.ok(createdEvent);
  assert.equal(createdEvent?.organization_id, 'ORG_A');
  assert.notEqual(createdEvent?.organization_id, null);
  assert.notEqual(createdEvent?.organization_id, undefined);
});

test('valid assignment stores assignee and emits an assignment event', async () => {
  let sent = false;
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => ({
      id: 'wo-2',
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: 'pending',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: null,
      assignee_phone_number: null,
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createWorkOrder: async () => ({}) as never,
    assignWorkOrder: async (id: string, assignee: string, phone?: string | null) => ({
      id,
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: 'assigned',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: assignee,
      assignee_phone_number: phone ?? null,
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    updateWorkOrderStatus: async () => ({}) as never,
    createWorkOrderEvent: async (payload: Record<string, unknown>) => {
      if (payload.event_type === 'work_order_assigned') {
        sent = true;
      }
      return payload;
    },
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: true, provider: 'africastalking', type: 'sms', message: 'assignment sent' }),
  });

  const workOrder = await service.assignWorkOrder('wo-2', 'user-ops', '+254712345678');

  assert.equal(workOrder.status, 'assigned');
  assert.equal(workOrder.assigned_to_user_id, 'user-ops');
  assert.equal(sent, true);
});

test('invalid status transition is rejected', async () => {
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => ({
      id: 'wo-3',
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: 'completed',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: 'user-ops',
      assignee_phone_number: '+254712345678',
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createWorkOrder: async () => ({}) as never,
    assignWorkOrder: async () => ({}) as never,
    updateWorkOrderStatus: async () => ({}) as never,
    createWorkOrderEvent: async () => ({}) as never,
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: true, provider: 'africastalking', type: 'sms', message: 'sent' }),
  });

  await assert.rejects(
    () => service.updateWorkOrderStatus('wo-3', 'assigned'),
    /status.*transition|invalid.*status/i,
  );
});

test('provider failure during status update does not crash workflow', async () => {
  let eventCount = 0;
  const service = new WorkOrderService({
    listWorkOrders: async () => [],
    getWorkOrderById: async () => ({
      id: 'wo-4',
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: 'assigned',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: 'user-ops',
      assignee_phone_number: '+254712345678',
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createWorkOrder: async () => ({}) as never,
    assignWorkOrder: async () => ({}) as never,
    updateWorkOrderStatus: async (id: string, status: string) => ({
      id,
      organization_id: 'org-1',
      site_id: null,
      title: 'Machine inspection',
      description: 'Inspect the machine line',
      priority: 'high',
      status: status as 'pending' | 'assigned' | 'in_progress' | 'completed',
      created_by_user_id: 'user-creator',
      assigned_to_user_id: 'user-ops',
      assignee_phone_number: '+254712345678',
      due_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    }),
    createWorkOrderEvent: async (payload: Record<string, unknown>) => {
      eventCount += 1;
      return payload;
    },
    listWorkOrderEvents: async () => [],
  } as never, {
    sendSms: async () => ({ ok: false, provider: 'africastalking', type: 'sms', message: 'provider rejected' }),
  });

  const workOrder = await service.updateWorkOrderStatus('wo-4', 'in_progress');

  assert.equal(workOrder.status, 'in_progress');
  assert.equal(eventCount, 2);
});
