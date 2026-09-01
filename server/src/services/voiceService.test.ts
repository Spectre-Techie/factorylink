import test from 'node:test';
import assert from 'node:assert/strict';

import type { AppUser } from './authService.js';
import type { WorkOrder } from './workOrderRepository.js';
import { VoiceService } from './voiceService.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const technicianId = '22222222-2222-4222-8222-222222222222';
const workOrderId = '33333333-3333-4333-8333-333333333333';

const actor: AppUser = {
  id: 'manager-1',
  organization_id: organizationId,
  name: 'Manager',
  email: 'manager@example.com',
  role: 'manager',
};

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: workOrderId,
    organization_id: organizationId,
    site_id: null,
    title: 'Generator inspection',
    description: 'Inspect the emergency generator',
    priority: 'high',
    status: 'assigned',
    created_by_user_id: actor.id,
    assigned_to_user_id: technicianId,
    assignee_phone_number: '+254712345678',
    due_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVoiceService(options: {
  workOrder?: WorkOrder | null;
  voiceResponse?: { ok: boolean; provider: string; type: string; message: string; requestId?: string };
  actor?: AppUser;
} = {}) {
  const events: Array<Record<string, unknown>> = [];
  let current = options.workOrder ?? makeWorkOrder();
  const smsMessages: string[] = [];
  const voiceCalls: Array<Record<string, unknown>> = [];
  const statusUpdates: string[] = [];

  const repository = {
    getWorkOrderById: async () => current,
    assignWorkOrder: async () => current,
    listWorkOrders: async () => [current],
    createWorkOrder: async () => current,
    updateWorkOrder: async () => current,
    updateWorkOrderStatus: async (_id: string, status: WorkOrder['status']) => {
      current = makeWorkOrder({ ...current, status });
      return current;
    },
    createWorkOrderEvent: async (input: Record<string, unknown>) => {
      events.unshift(input);
      return input;
    },
    listWorkOrderEvents: async () => events,
  };

  const workOrderService = {
    updateWorkOrderStatus: async (id: string, status: WorkOrder['status']) => {
      statusUpdates.push(`${id}:${status}`);
      events.unshift({
        organization_id: current.organization_id,
        work_order_id: id,
        event_type: 'work_order_status_changed',
        details: { previous_status: current.status, new_status: status },
      });
      current = makeWorkOrder({ ...current, status });
      return current;
    },
  };

  const service = new VoiceService({
    repository: repository as never,
    workOrderService: workOrderService as never,
    voiceProvider: {
      initiateVoiceCall: async (payload) => {
        voiceCalls.push(payload);
        return options.voiceResponse ?? {
          ok: true,
          provider: 'africastalking',
          type: 'voice',
          message: 'Voice call initiated successfully.',
          requestId: 'request-1',
        };
      },
    },
    smsProvider: {
      sendSms: async (payload) => {
        smsMessages.push(String(payload.message));
        return { ok: true, provider: 'test', type: 'sms', message: 'sent' };
      },
    },
    callerNumber: '+254700000000',
    callbackUrl: 'https://example.com/api/africastalking/voice',
  });

  return { service, events, smsMessages, voiceCalls, statusUpdates, actor: options.actor ?? actor };
}

test('valid voice-call initiation uses the assigned technician phone', async () => {
  const context = makeVoiceService();
  const result = await context.service.initiateWorkOrderCall(workOrderId, context.actor);

  assert.equal(result.message, 'Voice call initiated successfully.');
  assert.equal(context.voiceCalls[0].callFrom, '+254700000000');
  assert.equal(context.voiceCalls[0].callTo, '+254712345678');
  assert.match(String(context.voiceCalls[0].clientRequestId), /^work-order-/);
  assert.equal(context.events[0].event_type, 'work_order_voice_call_started');
});

test('voice-call initiation rejects a missing technician phone number', async () => {
  const context = makeVoiceService({ workOrder: makeWorkOrder({ assignee_phone_number: null }) });
  await assert.rejects(() => context.service.initiateWorkOrderCall(workOrderId, context.actor), /valid phone number/i);
  assert.equal(context.voiceCalls.length, 0);
});

test('voice-call initiation rejects cross-organization work-order access', async () => {
  const context = makeVoiceService({ workOrder: makeWorkOrder({ organization_id: otherOrganizationId }) });
  await assert.rejects(() => context.service.initiateWorkOrderCall(workOrderId, context.actor), /not found/i);
});

test('provider failure records a voice call failure event', async () => {
  const context = makeVoiceService({
    voiceResponse: {
      ok: false,
      provider: 'africastalking',
      type: 'voice',
      message: 'Voice call failed.',
      requestId: 'request-failed',
    },
  });

  await assert.rejects(() => context.service.initiateWorkOrderCall(workOrderId, context.actor), /Voice call failed/i);
  assert.equal(context.events[0].event_type, 'work_order_voice_call_failed');
});

test('voice callback validation rejects missing identity', async () => {
  const context = makeVoiceService();
  const response = await context.service.handleCallback({ workOrderId, callSessionId: '' });

  assert.match(response, /<Say>This voice session is invalid/i);
  assert.equal(context.events.length, 0);
});

test('DTMF 1 accepts an assigned task and records the authoritative events', async () => {
  const context = makeVoiceService();
  const response = await context.service.handleCallback({
    workOrderId,
    callSessionId: 'call-1',
    phoneNumber: '+254712345678',
    digits: '1',
  });

  assert.match(response, /task has been accepted/i);
  assert.deepEqual(context.statusUpdates, [`${workOrderId}:in_progress`]);
  assert.equal(context.events[0].event_type, 'work_order_voice_task_accepted');
  assert.equal(context.events[1].event_type, 'work_order_status_changed');
  assert.equal(context.smsMessages.length, 1);
});

test('DTMF 2 declines without completing or changing the task status', async () => {
  const context = makeVoiceService();
  const response = await context.service.handleCallback({
    workOrderId,
    callSessionId: 'call-2',
    phoneNumber: '+254712345678',
    digits: '2',
  });

  assert.match(response, /task has been declined/i);
  assert.deepEqual(context.statusUpdates, []);
  assert.equal(context.events[0].event_type, 'work_order_voice_task_declined');
  assert.equal(context.smsMessages.length, 1);
});

test('invalid DTMF input returns a controlled retry prompt', async () => {
  const context = makeVoiceService();
  const response = await context.service.handleCallback({ workOrderId, callSessionId: 'call-3', digits: '9' });

  assert.match(response, /Invalid choice/i);
  assert.equal(context.events.length, 0);
});

test('duplicate DTMF callback is idempotent', async () => {
  const context = makeVoiceService();
  const callback = { workOrderId, callSessionId: 'call-4', phoneNumber: '+254712345678', digits: '1' };
  const first = await context.service.handleCallback(callback);
  const second = await context.service.handleCallback(callback);

  assert.match(first, /task has been accepted/i);
  assert.match(second, /task has been accepted/i);
  assert.equal(context.events.filter((event) => event.event_type === 'work_order_voice_task_accepted').length, 1);
  assert.equal(context.smsMessages.length, 1);
});

test('callback rejects a phone number that is not the assigned technician', async () => {
  const context = makeVoiceService();
  const response = await context.service.handleCallback({
    workOrderId,
    callSessionId: 'call-5',
    phoneNumber: '+254700000002',
    digits: '1',
  });

  assert.match(response, /not authorized/i);
  assert.equal(context.events.length, 0);
  assert.deepEqual(context.statusUpdates, []);
});
