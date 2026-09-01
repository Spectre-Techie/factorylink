import test from 'node:test';
import assert from 'node:assert/strict';

import type { AppUser } from './authService.js';
import type { AirtimeReward } from './airtimeRepository.js';
import type { InventoryAlert, InventoryItem } from './inventoryRepository.js';
import type { WorkOrder } from './workOrderRepository.js';
import type { SalesReportRecord } from './ussdRepository.js';
import { getOperationalInsights, type InsightsDataSource } from './insightsService.js';

const org = 'org-a';
const otherOrg = 'org-b';
const manager: AppUser = { id: 'manager-a', organization_id: org, name: 'Manager', email: 'manager@test', role: 'manager' };
const operations: AppUser = { ...manager, id: 'operations-a', role: 'operations' };
const technician: AppUser = { ...manager, id: 'technician-a', role: 'technician' };

function workOrder(id: string, status: WorkOrder['status'], overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id, organization_id: org, site_id: null, title: id, description: id, priority: 'medium', status,
    created_by_user_id: manager.id, assigned_to_user_id: status === 'pending' ? null : 'tech-a',
    assignee_phone_number: '+254700000001', due_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

function source(overrides: Partial<InsightsDataSource> = {}): InsightsDataSource {
  const data: InsightsDataSource = {
    listWorkOrders: async () => [
      workOrder('overdue', 'assigned', { due_at: '2025-01-01T00:00:00.000Z' }),
      workOrder('pending-unassigned', 'pending'),
      workOrder('active', 'in_progress'),
      workOrder('completed', 'completed'),
      workOrder('other-org', 'assigned', { organization_id: otherOrg }),
    ],
    listWorkOrderEvents: async (id) => id === 'active' ? [{ id: 'event-1', organization_id: org, work_order_id: id, actor_user_id: null, event_type: 'work_order_notification_failed', details: {}, created_at: '2026-01-01T00:00:00.000Z' }] : [],
    listInventoryItems: async () => [{ id: 'stock-1', organization_id: org, sku: 'S-1', name: 'Critical Motor', quantity_available: 1, reorder_threshold: 5, unit: 'pcs', status: 'low_stock', updated_at: '2026-01-01T00:00:00.000Z' }, { id: 'other-stock', organization_id: otherOrg, sku: 'S-2', name: 'Other', quantity_available: 0, reorder_threshold: 5, unit: 'pcs', status: 'low_stock', updated_at: '2026-01-01T00:00:00.000Z' }] as InventoryItem[],
    listInventoryAlerts: async () => [{ id: 'alert-1', organization_id: org, inventory_item_id: 'stock-1', alert_type: 'low_stock', status: 'failed', message: 'Alert failed', created_at: '2026-01-01T00:00:00.000Z' }] as InventoryAlert[],
    listSalesReportsForOrganization: async () => [{ id: 'report-1', organization_id: org, distributor_id: 'dist-a', amount: 100000, status: 'submitted', created_at: '2026-01-01T00:00:00.000Z' }, { id: 'rejected', organization_id: org, distributor_id: 'dist-a', amount: 999999, status: 'rejected', created_at: '2026-01-01T00:00:00.000Z' }] as SalesReportRecord[],
    listRewardsForOrganization: async () => [{ id: 'reward-1', organization_id: org, distributor_id: 'dist-a', sales_report_id: 'report-1', phone_number: '+254700000001', amount: 100, currency: 'NGN', status: 'sent', provider_reference: 'ref', failure_reason: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }, { id: 'reward-2', organization_id: org, distributor_id: 'dist-a', sales_report_id: 'report-2', phone_number: '+254700000001', amount: 250, currency: 'NGN', status: 'failed', provider_reference: null, failure_reason: 'failed', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }] as AirtimeReward[],
  };
  return { ...data, ...overrides };
}

test('manager and operations receive organization-scoped insights', async () => {
  const insights = await getOperationalInsights(manager, source(), new Date('2026-01-01T00:00:00.000Z'));
  assert.deepEqual(insights.summary, { totalActiveWorkOrders: 3, pending: 1, assigned: 1, inProgress: 1, completed: 1, overdue: 1, unassignedPending: 1 });
  assert.deepEqual((await getOperationalInsights(operations, source())).distributorPerformance, insights.distributorPerformance);
  assert.equal(insights.inventoryRisk.topItems.length, 1);
  assert.equal(insights.inventoryRisk.topItems[0].name, 'Critical Motor');
});

test('technician access is rejected', async () => {
  await assert.rejects(() => getOperationalInsights(technician, source()), /access denied/i);
});

test('overdue and unassigned work orders are prioritized', async () => {
  const insights = await getOperationalInsights(manager, source(), new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(insights.attention[0].priority, 'critical');
  assert.equal(insights.attention[0].category, 'work_order');
  assert.ok(insights.attention.some((item) => item.message.includes('no assigned technician')));
});

test('inventory risk and failed alerts are calculated from persisted fields', async () => {
  const insights = await getOperationalInsights(manager, source());
  assert.equal(insights.inventoryRisk.lowStockItems, 1);
  assert.equal(insights.inventoryRisk.criticalAlerts, 1);
  assert.equal(insights.inventoryRisk.failedAlerts, 1);
});

test('sales and rewards aggregate only submitted and organization-scoped records', async () => {
  const insights = await getOperationalInsights(manager, source());
  assert.deepEqual(insights.distributorPerformance, { totalSalesReports: 1, totalReportedAmount: 100000, eligibleRewards: 2, totalRewardValue: 350, failedRewards: 1 });
});

test('failed notification events and rewards appear as attention items', async () => {
  const insights = await getOperationalInsights(manager, source());
  assert.ok(insights.attention.some((item) => item.category === 'work_order_notification'));
  assert.ok(insights.attention.some((item) => item.category === 'airtime_reward' && item.priority === 'attention'));
});

test('healthy completed work and sent rewards are included after attention items', async () => {
  const insights = await getOperationalInsights(manager, source());
  const healthy = insights.attention.filter((item) => item.priority === 'healthy');
  assert.ok(healthy.some((item) => item.category === 'work_order'));
  assert.ok(healthy.some((item) => item.category === 'airtime_reward'));
  assert.ok(insights.attention.findIndex((item) => item.priority === 'healthy') > insights.attention.findIndex((item) => item.priority === 'attention'));
});

test('zero-data organization returns zero metrics and no attention items', async () => {
  const empty: Partial<InsightsDataSource> = {
    listWorkOrders: async () => [], listWorkOrderEvents: async () => [], listInventoryItems: async () => [], listInventoryAlerts: async () => [], listSalesReportsForOrganization: async () => [], listRewardsForOrganization: async () => [],
  };
  const insights = await getOperationalInsights(manager, source(empty));
  assert.equal(insights.summary.totalActiveWorkOrders, 0);
  assert.equal(insights.distributorPerformance.totalRewardValue, 0);
  assert.deepEqual(insights.attention, []);
});

test('unavailable work-order event data does not leak another organization', async () => {
  const insights = await getOperationalInsights(manager, source({ listWorkOrderEvents: async () => [{ id: 'other-event', organization_id: otherOrg, work_order_id: 'other', actor_user_id: null, event_type: 'work_order_notification_failed', details: {}, created_at: '2026-01-01T00:00:00.000Z' }] }));
  assert.equal(insights.attention.filter((item) => item.category === 'work_order_notification').length, 0);
});
