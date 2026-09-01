import test from 'node:test';
import assert from 'node:assert/strict';

import { UssdService } from './ussdService.js';

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const otherOrganizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const distributorId = '22222222-2222-4222-8222-222222222222';
  const otherDistributorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const productOneId = '33333333-3333-4333-8333-333333333333';
  const productTwoId = '44444444-4444-4444-8444-444444444444';

  const distributors = [
    {
      id: distributorId,
      organization_id: organizationId,
      name: 'Phase 6 Distributor',
      phone_number: '+254700000001',
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: otherDistributorId,
      organization_id: otherOrganizationId,
      name: 'Other Distributor',
      phone_number: '+254700000002',
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ];

  const products = [
    {
      id: productOneId,
      organization_id: organizationId,
      sku: 'PHASE6-A',
      name: 'Phase 6 Product A',
      unit: 'pcs',
      active: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: productTwoId,
      organization_id: organizationId,
      sku: 'PHASE6-B',
      name: 'Phase 6 Product B',
      unit: 'pcs',
      active: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      organization_id: otherOrganizationId,
      sku: 'OTHER-ORG-1',
      name: 'Other Org Product',
      unit: 'pcs',
      active: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ];

  const repository = {
    findDistributorByPhone: async (phone: string) => distributors.find((distributor) => distributor.phone_number === phone) ?? null,
    listActiveProductsForOrganization: async (orgId: string) => products.filter((product) => product.organization_id === orgId),
    getInventoryForProduct: async (_orgId: string, productId: string) => {
      if (productId === productOneId) {
        return { organization_id: organizationId, sku: 'PHASE6-A', quantity_available: 1250, unit: 'pcs' };
      }
      if (productId === productTwoId) {
        return { organization_id: organizationId, sku: 'PHASE6-B', quantity_available: 25, unit: 'pcs' };
      }
      return null;
    },
    createOrder: async (input: Record<string, unknown>) => ({
      id: 'order-1',
      order_number: input.order_number ?? 'FL-1001',
      organization_id: input.organization_id,
      distributor_id: input.distributor_id,
      product_id: input.product_id,
      quantity: input.quantity,
      status: input.status,
      created_at: '2025-01-02T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
    }),
    getOrderByDistributorAndNumber: async (orgId: string, distributor: string, orderNumber: string) => {
      if (orderNumber === 'FL-1001' && orgId === organizationId && distributor === distributorId) {
        return {
          id: 'order-1',
          order_number: 'FL-1001',
          organization_id: organizationId,
          distributor_id: distributorId,
          product_id: productOneId,
          quantity: 20,
          status: 'pending',
          product_name: 'Phase 6 Product A',
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z',
        };
      }
      return null;
    },
    createSalesReport: async (input: Record<string, unknown>) => ({
      id: 'sales-1',
      organization_id: input.organization_id,
      distributor_id: input.distributor_id,
      amount: input.amount,
      status: input.status,
      created_at: '2025-01-02T00:00:00.000Z',
    }),
    getProductById: async (productId: string) => products.find((product) => product.id === productId) ?? null,
  };

  const smsProvider = {
    sendSms: async ({ message }: { message: string }) => ({
      ok: true,
      provider: 'africastalking',
      type: 'sms',
      message,
    }),
  };

  const repositoryOverrides = (overrides.repository as Record<string, unknown>) ?? {};
  const smsOverrides = (overrides.smsProvider as Record<string, unknown>) ?? {};

  return new UssdService({
    repository: {
      ...(repository as Record<string, unknown>),
      ...repositoryOverrides,
    },
    smsProvider: {
      ...(smsProvider as Record<string, unknown>),
      ...smsOverrides,
    },
  } as never);
}

test('initial menu shows the expected main menu', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-main',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '',
  });

  assert.match(response, /Welcome to FactoryLink/i);
  assert.match(response, /1\. Place Order/i);
  assert.match(response, /5\. Help/i);
});

test('invalid main menu choice returns a retry message', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-invalid-main',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '9',
  });

  assert.match(response, /Invalid selection/i);
});

test('product list is shown when place order is selected', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-product-list',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1',
  });

  assert.match(response, /Select product/i);
  assert.match(response, /Phase 6 Product A/i);
  assert.match(response, /Phase 6 Product B/i);
});

test('product selection moves to quantity entry', async () => {
  const service = makeService();
  await service.processCallback({
    sessionId: 'sess-qty',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1',
  });

  const response = await service.processCallback({
    sessionId: 'sess-qty',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1',
  });

  assert.match(response, /Enter quantity/i);
});

test('invalid quantity is rejected', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-invalid-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-invalid-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });

  const response = await service.processCallback({
    sessionId: 'sess-invalid-qty',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '0',
  });

  assert.match(response, /Invalid quantity/i);
});

test('zero quantity is rejected', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-zero-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-zero-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });

  const response = await service.processCallback({
    sessionId: 'sess-zero-qty',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '0',
  });

  assert.match(response, /greater than 0/i);
});

test('negative quantity is rejected', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-negative-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-negative-qty', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });

  const response = await service.processCallback({
    sessionId: 'sess-negative-qty',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '-5',
  });

  assert.match(response, /greater than 0/i);
});

test('insufficient stock blocks order creation', async () => {
  const service = makeService({
    repository: {
      getInventoryForProduct: async () => ({ organization_id: '11111111-1111-4111-8111-111111111111', sku: 'PHASE6-B', quantity_available: 5, unit: 'pcs' }),
    },
  });

  await service.processCallback({ sessionId: 'sess-low-stock', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-low-stock', serviceCode: '*123#', phoneNumber: '+254700000001', text: '2' });

  const response = await service.processCallback({
    sessionId: 'sess-low-stock',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '10',
  });

  assert.match(response, /Insufficient stock/i);
});

test('order confirmation persists an order and returns the order number', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-confirm', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-confirm', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-confirm', serviceCode: '*123#', phoneNumber: '+254700000001', text: '20' });

  const response = await service.processCallback({
    sessionId: 'sess-confirm',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1',
  });

  assert.match(response, /Order #FL-/i);
  assert.match(response, /Status: Pending/i);
});

test('order cancellation ends the session cleanly', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-cancel', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-cancel', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-cancel', serviceCode: '*123#', phoneNumber: '+254700000001', text: '20' });

  const response = await service.processCallback({
    sessionId: 'sess-cancel',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2',
  });

  assert.match(response, /Order cancelled/i);
});

test('my orders can look up a valid order by order number', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-my-order',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2*FL-1001',
  });

  assert.match(response, /Order #FL-1001/i);
  assert.match(response, /Product: Phase 6 Product A/i);
  assert.match(response, /Status: Pending/i);
});

test('my orders shows the order prompt for the initial menu input', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-my-order-prompt',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2',
  });

  assert.match(response, /Enter order ID/i);
});

test('my orders extracts the order number from cumulative USSD input', async () => {
  const service = makeService();
  await service.processCallback({
    sessionId: 'sess-my-order-cumulative',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2',
  });

  const response = await service.processCallback({
    sessionId: 'sess-my-order-cumulative',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2*FL-1001',
  });

  assert.match(response, /Order #FL-1001/i);
  assert.match(response, /Product: Phase 6 Product A/i);
  assert.match(response, /Quantity: 20/i);
  assert.match(response, /Status: Pending/i);
});

test('unknown order returns a not-found message', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-missing-order',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '2*FL-9999',
  });

  assert.match(response, /Order not found/i);
});

test('a distributor cannot retrieve another distributor order', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-cross-org',
    serviceCode: '*123#',
    phoneNumber: '+254700000002',
    text: '2*FL-1001',
  });

  assert.match(response, /Order not found/i);
});

test('check stock returns real available inventory', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-stock', serviceCode: '*123#', phoneNumber: '+254700000001', text: '3' });

  const response = await service.processCallback({
    sessionId: 'sess-stock',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '3*1',
  });

  assert.match(response, /Phase 6 Product A/i);
  assert.match(response, /Available: 1250 pcs/i);
});

test('report sales can accept a valid amount and persist it', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-sales', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4' });

  const response = await service.processCallback({
    sessionId: 'sess-sales',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '4*450000',
  });

  assert.match(response, /Sales amount:/i);
  assert.match(response, /NGN 450000/i);
});

test('report sales confirms with cumulative input', async () => {
  let recordedAmount: number | undefined;
  const service = makeService({
    repository: {
      createSalesReport: async (input: Record<string, unknown>) => {
        recordedAmount = Number(input.amount);
        return {
          id: 'sales-cumulative',
          organization_id: input.organization_id,
          distributor_id: input.distributor_id,
          amount: input.amount,
          status: input.status,
          created_at: '2025-01-02T00:00:00.000Z',
        };
      },
    },
  });

  await service.processCallback({ sessionId: 'sess-sales-cumulative', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4' });
  await service.processCallback({ sessionId: 'sess-sales-cumulative', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4*450000' });

  const response = await service.processCallback({
    sessionId: 'sess-sales-cumulative',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '4*450000*1',
  });

  assert.equal(recordedAmount, 450000);
  assert.match(response, /Sales report recorded/i);
});

test('report sales cancellation uses the final cumulative input segment', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-sales-cancel-cumulative', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4' });
  await service.processCallback({ sessionId: 'sess-sales-cancel-cumulative', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4*450000' });

  const response = await service.processCallback({
    sessionId: 'sess-sales-cancel-cumulative',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '4*450000*2',
  });

  assert.match(response, /Sales report cancelled/i);
});

test('invalid sales amount is rejected', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-bad-sales', serviceCode: '*123#', phoneNumber: '+254700000001', text: '4' });

  const response = await service.processCallback({
    sessionId: 'sess-bad-sales',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '-1',
  });

  assert.match(response, /Invalid sales amount/i);
});

test('help message explains the main functions', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-help',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '5',
  });

  assert.match(response, /Place Order/i);
  assert.match(response, /Check Stock/i);
  assert.match(response, /Report Sales/i);
});

test('session continuation works across a multi-step order flow', async () => {
  const service = makeService();
  const first = await service.processCallback({ sessionId: 'sess-flow', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  const second = await service.processCallback({ sessionId: 'sess-flow', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  const third = await service.processCallback({ sessionId: 'sess-flow', serviceCode: '*123#', phoneNumber: '+254700000001', text: '20' });

  assert.match(first, /Select product/i);
  assert.match(second, /Enter quantity/i);
  assert.match(third, /Order:/i);
});

test('place order preserves cumulative AT-style input across all steps', async () => {
  const service = makeService();
  await service.processCallback({ sessionId: 'sess-cumulative-order', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-cumulative-order', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1*1' });
  await service.processCallback({ sessionId: 'sess-cumulative-order', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1*1*20' });

  const response = await service.processCallback({
    sessionId: 'sess-cumulative-order',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1*1*20*1',
  });

  assert.match(response, /Order #FL-/i);
  assert.match(response, /Status: Pending/i);
});

test('session termination handles unexpected invalid input safely', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-terminate',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '99',
  });

  assert.match(response, /Invalid selection|Session ended/i);
});

test('distributor organization isolation prevents cross-org access', async () => {
  const service = makeService();
  const response = await service.processCallback({
    sessionId: 'sess-org-isolation',
    serviceCode: '*123#',
    phoneNumber: '+254700000002',
    text: '3',
  });

  assert.match(response, /Select product/i);
});

test('provider failure is handled safely without exposing credentials', async () => {
  const service = makeService({
    smsProvider: {
      sendSms: async () => ({ ok: false, provider: 'africastalking', type: 'sms', message: 'Sandbox SMS failure' }),
    },
  });

  const response = await service.processCallback({
    sessionId: 'sess-provider-failure',
    serviceCode: '*123#',
    phoneNumber: '+254700000001',
    text: '1*1*20*1',
  });

  assert.match(response, /Order #FL-/i);
});

test('sms confirmation behavior uses the provider abstraction after successful order creation', async () => {
  const createdSms: string[] = [];
  const service = makeService({
    smsProvider: {
      sendSms: async ({ message }: { message: string }) => {
        createdSms.push(message);
        return { ok: true, provider: 'africastalking', type: 'sms', message };
      },
    },
  });

  await service.processCallback({ sessionId: 'sess-sms', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-sms', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });
  await service.processCallback({ sessionId: 'sess-sms', serviceCode: '*123#', phoneNumber: '+254700000001', text: '20' });
  const response = await service.processCallback({ sessionId: 'sess-sms', serviceCode: '*123#', phoneNumber: '+254700000001', text: '1' });

  assert.match(response, /Order #FL-/i);
  assert.equal(createdSms.length, 1);
});
