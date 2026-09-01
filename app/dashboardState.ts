export type DashboardUser = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: 'manager' | 'operations' | 'technician';
};

export type DashboardSummary = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  byPriority: { low: number; medium: number; high: number };
};

export type DashboardWorkOrder = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assigned_to_user_id?: string | null;
  assignee_phone_number?: string | null;
  due_at?: string | null;
  created_at: string;
};

export type DashboardReward = {
  id: string;
  distributor_id: string;
  distributor_name?: string;
  sales_report_id: string;
  sales_amount?: number;
  phone_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'sent' | 'failed';
  provider_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderFilters = {
  status: string;
  priority: string;
  assignee: string;
};

export const defaultFilters: WorkOrderFilters = { status: '', priority: '', assignee: '' };

export function filterVisibleWorkOrders(workOrders: DashboardWorkOrder[], filters: WorkOrderFilters): DashboardWorkOrder[] {
  return workOrders.filter((workOrder) => (
    (!filters.status || workOrder.status === filters.status)
    && (!filters.priority || workOrder.priority === filters.priority)
    && (!filters.assignee || workOrder.assigned_to_user_id === filters.assignee)
  ));
}

export function roleLabel(role: DashboardUser['role']): string {
  return role === 'operations' ? 'Operations' : role[0].toUpperCase() + role.slice(1);
}
