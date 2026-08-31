export type WorkOrderSummary = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
};

export type Role = 'manager' | 'operations' | 'technician';

export type DashboardUser = {
  id: string;
  role: Role;
  organization_id: string;
};

export type DashboardWorkOrder = {
  id: string;
  organization_id: string;
  title: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigned_to_user_id?: string | null;
};

export function canUserAccessWorkOrder(user: DashboardUser | null, workOrder: DashboardWorkOrder | null): boolean {
  if (!user || !workOrder) {
    return false;
  }

  if (workOrder.organization_id !== user.organization_id) {
    return false;
  }

  if (user.role === 'manager' || user.role === 'operations') {
    return true;
  }

  if (user.role === 'technician') {
    return workOrder.assigned_to_user_id === user.id;
  }

  return false;
}

export function filterWorkOrdersForUser<T extends DashboardWorkOrder>(
  workOrders: T[],
  user: DashboardUser | null,
  filters: { status?: string; priority?: string } = {},
): T[] {
  if (!user) {
    return [];
  }

  return workOrders
    .filter((workOrder) => canUserAccessWorkOrder(user, workOrder))
    .filter((workOrder) => {
      if (filters.status && workOrder.status !== filters.status) {
        return false;
      }
      if (filters.priority && workOrder.priority !== filters.priority) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getDashboardSummary<T extends DashboardWorkOrder>(workOrders: T[]): WorkOrderSummary {
  const summary: WorkOrderSummary = {
    total: workOrders.length,
    pending: 0,
    in_progress: 0,
    completed: 0,
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
    },
  };

  for (const workOrder of workOrders) {
    if (workOrder.status === 'pending') summary.pending += 1;
    if (workOrder.status === 'in_progress') summary.in_progress += 1;
    if (workOrder.status === 'completed') summary.completed += 1;
    if (workOrder.priority === 'low') summary.byPriority.low += 1;
    if (workOrder.priority === 'medium') summary.byPriority.medium += 1;
    if (workOrder.priority === 'high') summary.byPriority.high += 1;
  }

  return summary;
}
