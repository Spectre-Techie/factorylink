import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultFilters, filterVisibleWorkOrders, roleLabel, type DashboardWorkOrder } from './dashboardState.js';

const workOrders: DashboardWorkOrder[] = [
  { id: 'one', title: 'Boiler inspection', priority: 'high', status: 'pending', assigned_to_user_id: null, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'two', title: 'Conveyor repair', priority: 'medium', status: 'in_progress', assigned_to_user_id: 'tech-1', created_at: '2026-01-02T00:00:00.000Z' },
];

test('dashboard filters are presentation-only and combine status, priority, and assignee', () => {
  assert.deepEqual(filterVisibleWorkOrders(workOrders, { ...defaultFilters, status: 'in_progress', assignee: 'tech-1' }).map((item) => item.id), ['two']);
  assert.deepEqual(filterVisibleWorkOrders(workOrders, { ...defaultFilters, priority: 'high' }).map((item) => item.id), ['one']);
});

test('role labels preserve the supported dashboard roles', () => {
  assert.equal(roleLabel('manager'), 'Manager');
  assert.equal(roleLabel('operations'), 'Operations');
  assert.equal(roleLabel('technician'), 'Technician');
});
