import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthService, hashPassword } from './authService.js';
import type { AuthRepository, AuthUserRecord } from './authRepository.js';
import { canUserAccessWorkOrder, filterWorkOrdersForUser, getDashboardSummary, type DashboardWorkOrder } from './dashboardService.js';

const workOrders: DashboardWorkOrder[] = [
  { id: 'wo-1', organization_id: 'org-demo', title: 'Boiler inspection', priority: 'high', status: 'pending', assigned_to_user_id: null },
  { id: 'wo-2', organization_id: 'org-demo', title: 'Conveyor repair', priority: 'medium', status: 'in_progress', assigned_to_user_id: 'user-tech' },
  { id: 'wo-3', organization_id: 'org-demo', title: 'Warehouse lighting', priority: 'low', status: 'completed', assigned_to_user_id: 'user-tech' },
  { id: 'wo-4', organization_id: 'other-org', title: 'Other org work order', priority: 'high', status: 'pending', assigned_to_user_id: 'user-other-tech' },
];

function createAuthService(users: AuthUserRecord[]) {
  const sessions = new Map<string, { token: string; user_id: string; expires_at: string }>();
  const repository: AuthRepository = {
    findUserByEmail: async (email) => users.find((user) => user.email === email) ?? null,
    findUserById: async (id) => users.find((user) => user.id === id) ?? null,
    findUsersByOrganization: async (organizationId, role) => users.filter((user) => user.organization_id === organizationId && (!role || user.role === role)).map((user) => ({
      id: user.id,
      organization_id: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
    })),
    createSession: async (session) => { sessions.set(session.token, session); },
    findSessionByToken: async (token) => sessions.get(token) ?? null,
    deleteSessionByToken: async (token) => sessions.delete(token),
  };
  return new AuthService(repository);
}

test('anonymous access is rejected before a valid session is established', async () => {
  const authService = createAuthService([]);
  assert.equal(await authService.resolveSession('missing-token'), null);
  assert.equal(await authService.hasValidSession('missing-token'), false);
});

test('operations users see only their organization work orders', async () => {
  const authService = createAuthService([{
    id: 'user-ops', email: 'ops@factorylink.local', name: 'Ops Lead', password_hash: await hashPassword('factorylink123'), role: 'operations', organization_id: 'org-demo',
  }]);
  const session = await authService.login('ops@factorylink.local', 'factorylink123');
  assert.ok(session);
  assert.equal(session.user.role, 'operations');
  assert.deepEqual(filterWorkOrdersForUser(workOrders, session.user, { status: 'in_progress' }).map((item) => item.id), ['wo-2']);
  assert.equal(canUserAccessWorkOrder(session.user, workOrders[3]), false);
});

test('technician users are limited to assigned work orders and their summary', async () => {
  const authService = createAuthService([{
    id: 'user-tech', email: 'tech@factorylink.local', name: 'Technician', password_hash: await hashPassword('factorylink123'), role: 'technician', organization_id: 'org-demo',
  }]);
  const session = await authService.login('tech@factorylink.local', 'factorylink123');
  assert.ok(session);
  const visible = filterWorkOrdersForUser(workOrders, session.user);
  assert.deepEqual(visible.map((item) => item.id), ['wo-2', 'wo-3']);
  const summary = getDashboardSummary(visible);
  assert.equal(summary.total, 2);
  assert.equal(summary.in_progress, 1);
  assert.equal(summary.completed, 1);
});

test('supported roles are authorized for the protected dashboard contract', async () => {
  const authService = createAuthService([{
    id: 'user-manager', email: 'manager@factorylink.local', name: 'Manager', password_hash: await hashPassword('factorylink123'), role: 'manager', organization_id: 'org-demo',
  }]);
  const session = await authService.login('manager@factorylink.local', 'factorylink123');
  assert.ok(session);
  assert.equal(authService.isDashboardAuthorized(session.user), true);
  assert.equal((await authService.getUserByToken(session.token))?.role, 'manager');
});
