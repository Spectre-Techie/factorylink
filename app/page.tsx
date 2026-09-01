'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  defaultFilters,
  filterVisibleWorkOrders,
  roleLabel,
  type DashboardSummary,
  type DashboardReward,
  type DashboardUser,
  type DashboardWorkOrder,
  type WorkOrderFilters,
} from './dashboardState';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'factorylink.auth-token';

type ApiResponse<T> = { ok: boolean; data?: T; message?: string };
type DashboardResponse = { summary: DashboardSummary; workOrders: DashboardWorkOrder[] };
type OrganizationUser = { id: string; organization_id: string; name: string; email: string; role: 'manager' | 'operations' | 'technician' };

type WorkOrderCreateForm = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
};

const defaultCreateForm: WorkOrderCreateForm = {
  title: '',
  description: '',
  priority: 'medium',
};

const allowedStatusTransitions: Record<DashboardWorkOrder['status'], DashboardWorkOrder['status'][]> = {
  pending: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: [],
};

class AuthenticationError extends Error {}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.json() as ApiResponse<T>;

  if (response.status === 401) throw new AuthenticationError();
  if (!response.ok || !body.ok || !body.data) throw new Error(body.message ?? 'Unable to complete this request.');
  return body.data;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function statusLabel(status: DashboardWorkOrder['status']): string {
  return status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1);
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workOrders, setWorkOrders] = useState<DashboardWorkOrder[]>([]);
  const [rewards, setRewards] = useState<DashboardReward[]>([]);
  const [organizationTechnicians, setOrganizationTechnicians] = useState<OrganizationUser[]>([]);
  const [filters, setFilters] = useState<WorkOrderFilters>(defaultFilters);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createForm, setCreateForm] = useState<WorkOrderCreateForm>(defaultCreateForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearAuthentication = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSummary(null);
    setWorkOrders([]);
  };

  const loadDashboard = async (activeToken: string) => {
    const currentUser = await request<DashboardUser>('/api/auth/me', activeToken);
    const [dashboard, visibleWorkOrders, technicians, visibleRewards] = await Promise.all([
      request<DashboardResponse>('/api/dashboard/summary', activeToken),
      request<DashboardWorkOrder[]>('/api/work-orders', activeToken),
      currentUser.role === 'technician' ? Promise.resolve([]) : request<OrganizationUser[]>(`/api/users?role=technician`, activeToken),
      currentUser.role === 'technician' ? Promise.resolve([]) : request<DashboardReward[]>('/api/distributor/rewards', activeToken),
    ]);

    setToken(activeToken);
    setUser(currentUser);
    setSummary(dashboard.summary);
    setWorkOrders(visibleWorkOrders);
    setOrganizationTechnicians(technicians);
    setRewards(visibleRewards);
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    void loadDashboard(storedToken)
      .catch((loadError) => {
        if (loadError instanceof AuthenticationError) clearAuthentication();
        setError(loadError instanceof AuthenticationError ? 'Your session has expired. Please sign in again.' : 'Unable to load the dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredWorkOrders = useMemo(() => filterVisibleWorkOrders(workOrders, filters), [workOrders, filters]);
  const assignees = useMemo(() => [...new Set(workOrders.map((item) => item.assigned_to_user_id).filter(Boolean))] as string[], [workOrders]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const login = await request<{ token: string; user: DashboardUser }>('/api/auth/login', undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem(TOKEN_KEY, login.token);
      setPassword('');
      await loadDashboard(login.token);
    } catch (loginError) {
      clearAuthentication();
      setError(loginError instanceof AuthenticationError ? 'Unable to sign in. Check your credentials and try again.' : 'Unable to sign in. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const handleCreateWorkOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !user) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await request<DashboardWorkOrder>('/api/work-orders', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organization_id,
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
        }),
      });
      setCreateForm(defaultCreateForm);
      await loadDashboard(token);
      setNotice('Work order created successfully.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create work order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignWorkOrder = async (workOrderId: string, assigneeId: string) => {
    if (!token || !assigneeId) return;

    setActionBusyId(workOrderId);
    setError(null);
    setNotice(null);

    try {
      await request<DashboardWorkOrder>(`/api/work-orders/${workOrderId}/assign`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: assigneeId }),
      });
      await loadDashboard(token);
      setNotice('Work order assigned successfully.');
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Unable to assign work order.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleStatusUpdate = async (workOrderId: string, nextStatus: DashboardWorkOrder['status']) => {
    if (!token || !nextStatus) return;

    setActionBusyId(workOrderId);
    setError(null);
    setNotice(null);

    try {
      await request<DashboardWorkOrder>(`/api/work-orders/${workOrderId}/status`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadDashboard(token);
      setNotice('Work order status updated successfully.');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update work order status.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleVoiceCall = async (workOrderId: string) => {
    if (!token) return;

    setActionBusyId(workOrderId);
    setError(null);
    setNotice(null);

    try {
      await request<{ message: string }>(`/api/work-orders/${workOrderId}/voice-call`, token, { method: 'POST' });
      setNotice('Call initiated successfully.');
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to initiate technician call.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleLogout = async () => {
    const activeToken = token;
    clearAuthentication();
    setFilters(defaultFilters);
    if (!activeToken) return;

    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${activeToken}` } });
    } catch {
      // Local authentication state is cleared even if the network is unavailable.
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">Loading FactoryLink…</main>;
  }

  if (!user || !summary) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">FactoryLink</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Operations sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use your operational account to access organization-scoped work orders.</p>
          <form className="mt-7 space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-slate-700">Email
              <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="block text-sm font-medium text-slate-700">Password
              <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">FactoryLink</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Operational dashboard</h1>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="text-right text-sm">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="text-slate-500">{roleLabel(user.role)} · Org {user.organization_id.slice(0, 8)}</p>
            </div>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
        {user.role !== 'technician' && (
          <form className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleCreateWorkOrder}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1 text-sm font-medium text-slate-700">Title
                <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label className="w-full md:w-40 text-sm font-medium text-slate-700">Priority
                <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as WorkOrderCreateForm['priority'] }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">Description
              <textarea className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" rows={3} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} required />
            </label>
            <div className="mt-4 flex justify-end">
              <button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400" type="submit" disabled={submitting || !createForm.title.trim() || !createForm.description.trim()}>
                {submitting ? 'Creating…' : 'Create work order'}
              </button>
            </div>
          </form>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total work orders', summary.total, 'text-slate-950'],
            ['Pending', summary.pending, 'text-amber-700'],
            ['In progress', summary.in_progress, 'text-blue-700'],
            ['Completed', summary.completed, 'text-emerald-700'],
          ].map(([label, value, color]) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Priority breakdown</p>
          <div className="mt-2 flex gap-5 text-sm text-slate-700"><span>High <strong>{summary.byPriority.high}</strong></span><span>Medium <strong>{summary.byPriority.medium}</strong></span><span>Low <strong>{summary.byPriority.low}</strong></span></div>
        </div>

        {user.role !== 'technician' && (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-lg font-bold text-slate-950">Distributor Rewards</h2>
              <p className="text-sm text-slate-500">Organization-scoped sales reporting incentives.</p>
            </div>
            {rewards.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No distributor rewards yet.</p> : (
              <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Distributor</th><th className="px-5 py-3">Sales amount</th><th className="px-5 py-3">Reward</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-100">{rewards.map((reward) => (
                <tr key={reward.id} className="text-slate-700"><td className="px-5 py-4 font-medium text-slate-900">{reward.distributor_id}</td><td className="px-5 py-4">{reward.currency} {reward.sales_amount ?? '—'}</td><td className="px-5 py-4">{reward.currency} {reward.amount}</td><td className="px-5 py-4 capitalize">{reward.status}</td><td className="px-5 py-4">{formatDate(reward.created_at)}</td></tr>
              ))}</tbody></table></div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-bold text-slate-950">Work orders</h2><p className="text-sm text-slate-500">{user.role === 'technician' ? 'Only work orders assigned to you are shown.' : 'Showing work orders in your organization.'}</p></div>
              <button className="text-sm font-semibold text-blue-700 hover:text-blue-800" type="button" onClick={() => setFilters(defaultFilters)}>Clear filters</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Status<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
              <label className="text-sm font-medium text-slate-700">Priority<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
              <label className="text-sm font-medium text-slate-700">Assignee<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.assignee} onChange={(event) => setFilters({ ...filters, assignee: event.target.value })}><option value="">All assignees</option>{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}</select></label>
            </div>
          </div>
          {filteredWorkOrders.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">No work orders found.</p> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Assigned user</th><th className="px-5 py-3">Due date</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredWorkOrders.map((workOrder) => {
              const availableStatuses = allowedStatusTransitions[workOrder.status] ?? [];

              return (
                <tr key={workOrder.id} className="align-top text-slate-700">
                  <td className="px-5 py-4 font-medium text-slate-900">{workOrder.title}</td>
                  <td className="px-5 py-4 capitalize">{workOrder.priority}</td>
                  <td className="px-5 py-4">{statusLabel(workOrder.status)}</td>
                  <td className="px-5 py-4">{workOrder.assigned_to_user_id ?? 'Unassigned'}</td>
                  <td className="px-5 py-4">{formatDate(workOrder.due_at)}</td>
                  <td className="px-5 py-4">{formatDate(workOrder.created_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {user.role !== 'technician' && (
                        <select className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" value={workOrder.assigned_to_user_id ?? ''} onChange={(event) => {
                          const assigneeId = event.target.value;
                          if (!assigneeId) return;
                          void handleAssignWorkOrder(workOrder.id, assigneeId);
                        }} disabled={actionBusyId === workOrder.id || organizationTechnicians.length === 0}>
                          <option value="">Assign technician</option>
                          {organizationTechnicians.map((person) => (
                            <option key={person.id} value={person.id}>{person.name}</option>
                          ))}
                        </select>
                      )}
                      {availableStatuses.length > 0 && (
                        <select className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" value={workOrder.status} onChange={(event) => {
                          const nextStatus = event.target.value as DashboardWorkOrder['status'];
                          void handleStatusUpdate(workOrder.id, nextStatus);
                        }} disabled={actionBusyId === workOrder.id}>
                          <option value={workOrder.status}>{statusLabel(workOrder.status)}</option>
                          {availableStatuses.map((nextStatus) => (
                            <option key={nextStatus} value={nextStatus}>{statusLabel(nextStatus)}</option>
                          ))}
                        </select>
                      )}
                      {user.role !== 'technician' && workOrder.status === 'assigned' && /^\+[1-9]\d{7,14}$/.test(workOrder.assignee_phone_number ?? '') && (
                        <button className="w-full rounded-lg border border-blue-200 px-2 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void handleVoiceCall(workOrder.id)} disabled={actionBusyId === workOrder.id}>
                          {actionBusyId === workOrder.id ? 'Calling...' : 'Call technician'}
                        </button>
                      )}
                      {actionBusyId === workOrder.id && <span className="text-[11px] font-medium text-slate-500">Updating…</span>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody></table></div>
          )}
        </section>
      </section>
    </main>
  );
}
