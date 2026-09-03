'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

import {
  defaultFilters,
  filterVisibleWorkOrders,
  roleLabel,
  type DashboardInsights,
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
type InventoryItem = { id: string; sku: string; name: string; quantity_available: number; reorder_threshold: number; unit: string; status: 'active' | 'low_stock' | 'archived'; updated_at: string };

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

function formatAttentionMessage(message: string, workOrders: DashboardWorkOrder[]): string {
  return message.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, (id) => {
    return workOrders.find((workOrder) => workOrder.id === id)?.title ?? 'the referenced work order';
  });
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workOrders, setWorkOrders] = useState<DashboardWorkOrder[]>([]);
  const [rewards, setRewards] = useState<DashboardReward[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [organizationTechnicians, setOrganizationTechnicians] = useState<OrganizationUser[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkOrderFilters>(defaultFilters);
  const [activeView, setActiveView] = useState<'overview' | 'work-orders' | 'inventory' | 'insights' | 'rewards'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
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
    setInventoryLoading(true);
    setInventoryError(null);
    const [dashboard, visibleWorkOrders, technicians, visibleRewards, visibleInventory] = await Promise.all([
      request<DashboardResponse>('/api/dashboard/summary', activeToken),
      request<DashboardWorkOrder[]>('/api/work-orders', activeToken),
      currentUser.role === 'technician' ? Promise.resolve([]) : request<OrganizationUser[]>(`/api/users?role=technician`, activeToken),
      currentUser.role === 'technician' ? Promise.resolve([]) : request<DashboardReward[]>('/api/distributor/rewards', activeToken),
      request<InventoryItem[]>('/api/inventory', activeToken),
    ]);

    setToken(activeToken);
    setUser(currentUser);
    setSummary(dashboard.summary);
    setWorkOrders(visibleWorkOrders);
    setOrganizationTechnicians(technicians);
    setRewards(visibleRewards);
    setInventory(visibleInventory);
    setInventoryLoading(false);
    if (currentUser.role !== 'technician') {
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        setInsights(await request<DashboardInsights>('/api/dashboard/insights', activeToken));
      } catch {
        setInsightsError('Operational insights are temporarily unavailable.');
      } finally {
        setInsightsLoading(false);
      }
    }
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
        setInventoryLoading(false);
        setInventoryError('Inventory data is temporarily unavailable.');
        setError(loadError instanceof AuthenticationError ? 'Your session has expired. Please sign in again.' : 'Unable to load the dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredWorkOrders = useMemo(() => filterVisibleWorkOrders(workOrders, filters), [workOrders, filters]);
  const filteredInventory = useMemo(() => inventory.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(inventorySearch.trim().toLowerCase())), [inventory, inventorySearch]);
  const assignees = useMemo(() => organizationTechnicians.map((person) => ({ id: person.id, name: person.name })), [organizationTechnicians]);
  const resolveAssigneeLabel = (assigneeId: string | null | undefined): string => {
    if (!assigneeId) return 'Unassigned';
    const technician = organizationTechnicians.find((person) => person.id === assigneeId);
    if (user?.role === 'technician' && assigneeId === user.id) return 'You';
    return technician?.name ?? 'Unassigned';
  };
  const navigateTo = (view: typeof activeView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    setNotice(null);
  };
  const displayName = /^phase\s+5\b/i.test(user?.name ?? '') ? roleLabel(user?.role ?? 'manager') : user?.name;

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.title = user ? 'FactoryLink — Operations' : 'FactoryLink — Operations';
  }, [user]);

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
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">FactoryLink Operations</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to your organization-scoped operations control center.</p>
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
    <main className="min-h-screen bg-[#f4f7f8] text-slate-950">
      <header className="border-b border-slate-800 bg-[#10252b] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Image src="/factorylink-navbar-logo.png" alt="FactoryLink logo" width={88} height={88} className="h-20 w-20 object-contain" priority />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-200">Industrial Operations Platform</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <button type="button" className="mobile-menu-button" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
              <span className="sr-only">Toggle navigation</span>
              <span aria-hidden="true" className="menu-lines"><span /><span /><span /></span>
              <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
            <nav className="hidden max-w-full flex-wrap gap-1 pb-1 md:flex" aria-label="Primary navigation">
              {([['overview', 'Overview'], ['work-orders', 'Work Orders'], ['inventory', 'Inventory'], ['insights', 'Operational Insights'], ['rewards', 'Distributor Rewards']] as const)
                .filter(([view]) => view === 'overview' || view === 'work-orders' || view === 'inventory' || user.role !== 'technician')
                .map(([view, label]) => (
                  <button key={view} type="button" onClick={() => navigateTo(view)} aria-current={activeView === view ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${activeView === view ? 'border-cyan-300 text-white' : 'border-transparent text-slate-300 hover:border-slate-500 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
            </nav>
            {mobileMenuOpen && <nav id="mobile-navigation" className="mobile-navigation md:hidden" aria-label="Mobile navigation">
              {([['overview', 'Overview'], ['work-orders', 'Work Orders'], ['inventory', 'Inventory'], ['insights', 'Operational Insights'], ['rewards', 'Distributor Rewards']] as const)
                .filter(([view]) => view === 'overview' || view === 'work-orders' || view === 'inventory' || user.role !== 'technician')
                .map(([view, label]) => (
                  <button key={view} type="button" onClick={() => navigateTo(view)} aria-current={activeView === view ? 'page' : undefined} className={activeView === view ? 'mobile-nav-item mobile-nav-item-active' : 'mobile-nav-item'}>
                    {label}
                  </button>
                ))}
            </nav>}
            <div className="flex items-center justify-between gap-4 text-sm lg:justify-end">
              <div className="text-right">
                <p className="font-semibold">{displayName}</p>
                {displayName !== roleLabel(user.role) && <p className="text-slate-300">{roleLabel(user.role)}</p>}
              </div>
              <button className="rounded-md border border-slate-500 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" type="button" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {error && <p role="alert" aria-live="assertive" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {notice && <div role="status" aria-live="polite" className="toast toast-success">{notice}</div>}
        {activeView === 'overview' && (
          <section aria-labelledby="overview-heading" className="mb-8">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div><p className="section-kicker">Operational status</p><h2 id="overview-heading" className="mt-1 text-3xl font-bold tracking-tight">What needs attention today?</h2></div>
              <p className="max-w-md text-sm leading-6 text-slate-600">A focused view of work health, stock risk, and the actions your team can take next.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[['Work orders', summary.total, 'Total in your organization'], ['Pending', summary.pending, 'Waiting for action'], ['In progress', summary.in_progress, 'Currently being handled'], ['Completed', summary.completed, 'Closed successfully']].map(([label, value, detail]) => (
                <article key={label} className="metric-panel"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="surface-panel lg:col-span-2"><div className="flex items-center justify-between"><div><p className="section-kicker">Attention required</p><h3 className="mt-1 text-lg font-bold">Priority signals</h3></div>{user.role !== 'technician' && <button type="button" onClick={() => navigateTo('insights')} className="text-sm font-bold text-cyan-800 hover:text-cyan-950">Open insights</button>}</div>
                {insights?.attention?.length ? <ul className="mt-4 space-y-2">{insights.attention.slice(0, 4).map((item, index) => <li key={`${item.category}-${item.title}-${index}`} className="flex gap-3 border-t border-slate-200 py-3 text-sm"><span className={`status-badge ${item.priority === 'critical' ? 'status-critical' : item.priority === 'attention' ? 'status-attention' : 'status-healthy'}`}>{item.priority}</span><span><strong>{item.title}</strong><span className="block text-slate-600">{formatAttentionMessage(item.message, workOrders)}</span></span></li>)}</ul> : <p className="mt-4 rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800">No operational issues require attention.</p>}
              </div>
              <div className="surface-panel"><p className="section-kicker">Inventory risk</p><h3 className="mt-1 text-lg font-bold">Stock position</h3>{insights ? <div className="mt-4 grid grid-cols-3 gap-3"><div><p className="text-xs text-slate-500">Low stock</p><p className="mt-1 text-2xl font-bold text-amber-700">{insights.inventoryRisk.lowStockItems}</p></div><div><p className="text-xs text-slate-500">Critical</p><p className="mt-1 text-2xl font-bold text-red-700">{insights.inventoryRisk.criticalAlerts}</p></div><div><p className="text-xs text-slate-500">Failed alerts</p><p className="mt-1 text-2xl font-bold text-slate-900">{insights.inventoryRisk.failedAlerts}</p></div></div> : <p className="mt-4 text-sm text-slate-500">Insights are still loading.</p>}<button type="button" onClick={() => navigateTo('inventory')} className="mt-5 text-sm font-bold text-cyan-800 hover:text-cyan-950">Review inventory</button></div>
              {user.role !== 'technician' && <div className="surface-panel lg:col-span-3"><div className="flex items-center justify-between"><div><p className="section-kicker">Distributor signals</p><h3 className="mt-1 text-lg font-bold">Sales and rewards</h3></div><button type="button" onClick={() => navigateTo('rewards')} className="text-sm font-bold text-cyan-800 hover:text-cyan-950">Review rewards</button></div>{insights ? <div className="mt-4 grid gap-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">Sales reports</p><p className="mt-1 text-xl font-bold">{insights.distributorPerformance.totalSalesReports}</p></div><div><p className="text-xs text-slate-500">Reported sales</p><p className="mt-1 text-xl font-bold">NGN {insights.distributorPerformance.totalReportedAmount}</p></div><div><p className="text-xs text-slate-500">Eligible rewards</p><p className="mt-1 text-xl font-bold">{insights.distributorPerformance.eligibleRewards}</p></div><div><p className="text-xs text-slate-500">Reward value</p><p className="mt-1 text-xl font-bold">NGN {insights.distributorPerformance.totalRewardValue}</p></div></div> : <p className="mt-4 text-sm text-slate-500">Distributor signals are still loading.</p>}</div>}
            </div>
          </section>
        )}
        {activeView === 'work-orders' && user.role !== 'technician' && (
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
        {activeView === 'insights' && user.role !== 'technician' && (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Operational Insights</h2>
                <p className="text-sm text-slate-500">A current view of work health, inventory risk, and distributor performance.</p>
              </div>
              {insightsLoading && <span className="text-sm font-medium text-slate-500">Loading...</span>}
            </div>
            {insightsError ? <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{insightsError}</p> : insightsLoading ? <div className="mt-5 h-28 rounded-lg bg-slate-50" aria-label="Loading operational insights" /> : insights && (
              <div className="mt-5 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Active', insights.summary.totalActiveWorkOrders],
                    ['Pending', insights.summary.pending],
                    ['Assigned', insights.summary.assigned],
                    ['In progress', insights.summary.inProgress],
                    ['Completed', insights.summary.completed],
                    ['Overdue', insights.summary.overdue],
                  ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-3"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p></div>)}
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Inventory Risk</h3>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm"><span>Low stock <strong>{insights.inventoryRisk.lowStockItems}</strong></span><span>Critical <strong>{insights.inventoryRisk.criticalAlerts}</strong></span><span>Failed alerts <strong>{insights.inventoryRisk.failedAlerts}</strong></span></div>
                    {insights.inventoryRisk.topItems.length > 0 ? <ul className="mt-3 space-y-2 text-sm text-slate-700">{insights.inventoryRisk.topItems.map((item) => <li key={item.id} className="flex justify-between border-b border-slate-100 py-2"><span>{item.name}</span><strong>{item.quantityAvailable} / {item.reorderThreshold} {item.unit}</strong></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No inventory items require attention.</p>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Distributor Performance</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><span>Reports <strong>{insights.distributorPerformance.totalSalesReports}</strong></span><span>Sales <strong>NGN {insights.distributorPerformance.totalReportedAmount}</strong></span><span>Rewards <strong>{insights.distributorPerformance.eligibleRewards}</strong></span><span>Value <strong>NGN {insights.distributorPerformance.totalRewardValue}</strong></span></div>
                    <p className="mt-3 text-sm text-slate-500">Failed rewards: <strong className="text-slate-700">{insights.distributorPerformance.failedRewards}</strong></p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Attention</h3>
                  {insights.attention.length === 0 ? <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No operational issues require attention.</p> : <ul className="mt-3 space-y-2">{insights.attention.map((item, index) => <li key={`${item.category}-${item.title}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm"><span className="min-w-20 font-bold uppercase text-slate-600">{item.priority}</span><span><strong className="text-slate-900">{item.title}</strong><span className="block text-slate-600">{formatAttentionMessage(item.message, workOrders)}</span></span></li>)}</ul>}
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === 'rewards' && user.role !== 'technician' && (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-lg font-bold text-slate-950">Distributor Rewards</h2>
              <p className="text-sm text-slate-500">Organization-scoped sales reporting incentives.</p>
            </div>
            {rewards.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No distributor rewards yet.</p> : (
              <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Distributor</th><th className="px-5 py-3">Sales amount</th><th className="px-5 py-3">Reward</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-100">{rewards.map((reward) => (
                <tr key={reward.id} className="text-slate-700"><td className="px-5 py-4 font-medium text-slate-900">{reward.distributor_name ?? 'Unknown distributor'}</td><td className="px-5 py-4">{reward.currency} {reward.sales_amount ?? '—'}</td><td className="px-5 py-4">{reward.currency} {reward.amount}</td><td className="px-5 py-4 capitalize">{reward.status}</td><td className="px-5 py-4">{formatDate(reward.created_at)}</td></tr>
              ))}</tbody></table></div>
            )}
          </section>
        )}

        {activeView === 'work-orders' && <section className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-bold text-slate-950">Work orders</h2><p className="text-sm text-slate-500">{user.role === 'technician' ? 'Only work orders assigned to you are shown.' : 'Showing work orders in your organization.'}</p></div>
              <button className="text-sm font-semibold text-blue-700 hover:text-blue-800" type="button" onClick={() => setFilters(defaultFilters)}>Clear filters</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Status<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
              <label className="text-sm font-medium text-slate-700">Priority<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
              <label className="text-sm font-medium text-slate-700">Assignee<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={filters.assignee} onChange={(event) => setFilters({ ...filters, assignee: event.target.value })}><option value="">All assignees</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select></label>
            </div>
          </div>
          {filteredWorkOrders.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">No work orders found.</p> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Assigned user</th><th className="px-5 py-3">Due date</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredWorkOrders.map((workOrder) => {
              const availableStatuses = allowedStatusTransitions[workOrder.status] ?? [];

              return (
                <tr key={workOrder.id} className="align-top text-slate-700">
                  <td className="px-5 py-4 font-medium text-slate-900">{workOrder.title}</td>
                  <td className="px-5 py-4"><span className={`status-badge ${workOrder.priority === 'high' ? 'status-critical' : workOrder.priority === 'medium' ? 'status-attention' : 'status-neutral'}`}>{workOrder.priority}</span></td>
                  <td className="px-5 py-4"><span className={`status-badge ${workOrder.status === 'completed' ? 'status-healthy' : workOrder.status === 'in_progress' ? 'status-attention' : 'status-neutral'}`}>{statusLabel(workOrder.status)}</span></td>
                  <td className="px-5 py-4">{resolveAssigneeLabel(workOrder.assigned_to_user_id)}</td>
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
        </section>}
        {activeView === 'inventory' && (
          <section aria-labelledby="inventory-heading" className="surface-panel mt-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">Stock control</p><h2 id="inventory-heading" className="mt-1 text-2xl font-bold">Inventory</h2><p className="mt-1 text-sm text-slate-600">Organization-scoped stock levels and reorder signals.</p></div><label className="w-full text-sm font-semibold text-slate-700 sm:max-w-xs">Search inventory<input className="field-control mt-1.5" type="search" placeholder="Product or SKU" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} /></label></div>
            {inventoryLoading ? <p className="py-12 text-center text-sm text-slate-500" role="status">Loading inventory...</p> : inventoryError ? <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{inventoryError} Try refreshing your session.</p> : filteredInventory.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No inventory items match this search.</p> : <div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Reorder threshold</th><th>Stock state</th><th>Updated</th></tr></thead><tbody>{filteredInventory.map((item) => <tr key={item.id}><td className="font-semibold text-slate-950">{item.name}</td><td>{item.sku}</td><td>{item.quantity_available} {item.unit}</td><td>{item.reorder_threshold} {item.unit}</td><td><span className={`status-badge ${item.status === 'low_stock' ? 'status-attention' : item.status === 'archived' ? 'status-neutral' : 'status-healthy'}`}>{item.status === 'low_stock' ? 'Low stock' : item.status === 'archived' ? 'Archived' : 'In stock'}</span></td><td>{formatDate(item.updated_at)}</td></tr>)}</tbody></table></div>}
          </section>
        )}
      </section>
    </main>
  );
}
