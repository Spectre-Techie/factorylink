export type WorkOrderPriority = 'low' | 'medium' | 'high';
export type WorkOrderStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';

export interface WorkOrder {
  id: string;
  organization_id: string;
  site_id: string | null;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  created_by_user_id: string | null;
  assigned_to_user_id: string | null;
  assignee_phone_number: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderInput {
  organization_id: string;
  site_id?: string | null;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status?: WorkOrderStatus;
  created_by_user_id?: string | null;
  assigned_to_user_id?: string | null;
  assignee_phone_number?: string | null;
  due_at?: string | null;
}

export interface WorkOrderEvent {
  id: string;
  organization_id: string;
  work_order_id: string;
  actor_user_id: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface WorkOrderEventInput {
  organization_id: string;
  work_order_id: string;
  actor_user_id?: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at?: string;
}

export type WorkOrderUpdate = Partial<Pick<WorkOrder, 'site_id' | 'title' | 'description' | 'priority' | 'status' | 'assigned_to_user_id' | 'assignee_phone_number' | 'due_at'>>;

export interface WorkOrderRepository {
  listWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrderById(id: string): Promise<WorkOrder | null>;
  createWorkOrder(input: WorkOrderInput): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: WorkOrderUpdate): Promise<WorkOrder>;
  assignWorkOrder(id: string, assigneeId: string, phoneNumber?: string | null): Promise<WorkOrder>;
  updateWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<WorkOrder>;
  createWorkOrderEvent(input: WorkOrderEventInput): Promise<WorkOrderEvent>;
  listWorkOrderEvents(workOrderId: string): Promise<WorkOrderEvent[]>;
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private workOrders: WorkOrder[] = [];
  private events: WorkOrderEvent[] = [];

  async listWorkOrders(): Promise<WorkOrder[]> {
    return [...this.workOrders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    return this.workOrders.find((entry) => entry.id === id) ?? null;
  }

  async createWorkOrder(input: WorkOrderInput): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const workOrder: WorkOrder = {
      id: `wo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      site_id: input.site_id ?? null,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status ?? 'pending',
      created_by_user_id: input.created_by_user_id ?? null,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      assignee_phone_number: input.assignee_phone_number ?? null,
      due_at: input.due_at ?? null,
      created_at: now,
      updated_at: now,
    };
    this.workOrders.unshift(workOrder);
    return workOrder;
  }

  async assignWorkOrder(id: string, assigneeId: string, phoneNumber?: string | null): Promise<WorkOrder> {
    const workOrder = this.workOrders.find((entry) => entry.id === id);
    if (!workOrder) throw new Error(`Work order not found: ${id}`);

    workOrder.assigned_to_user_id = assigneeId;
    workOrder.assignee_phone_number = phoneNumber ?? workOrder.assignee_phone_number ?? null;
    workOrder.status = 'assigned';
    workOrder.updated_at = new Date().toISOString();
    return workOrder;
  }

  async updateWorkOrder(id: string, updates: WorkOrderUpdate): Promise<WorkOrder> {
    const workOrder = this.workOrders.find((entry) => entry.id === id);
    if (!workOrder) throw new Error(`Work order not found: ${id}`);

    Object.assign(workOrder, updates, { updated_at: new Date().toISOString() });
    return workOrder;
  }

  async updateWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<WorkOrder> {
    const workOrder = this.workOrders.find((entry) => entry.id === id);
    if (!workOrder) throw new Error(`Work order not found: ${id}`);

    workOrder.status = status;
    workOrder.updated_at = new Date().toISOString();
    return workOrder;
  }

  async createWorkOrderEvent(input: WorkOrderEventInput): Promise<WorkOrderEvent> {
    const event: WorkOrderEvent = {
      id: `woe-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      work_order_id: input.work_order_id,
      actor_user_id: input.actor_user_id ?? null,
      event_type: input.event_type,
      details: input.details,
      created_at: input.created_at ?? new Date().toISOString(),
    };

    this.events.unshift(event);
    return event;
  }

  async listWorkOrderEvents(workOrderId: string): Promise<WorkOrderEvent[]> {
    return [...this.events]
      .filter((event) => event.work_order_id === workOrderId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

import { createClient } from '@supabase/supabase-js';

export function createWorkOrderRepository(): WorkOrderRepository {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (url && serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return {
      async listWorkOrders() {
        const { data, error } = await supabase.from('work_orders').select('*').order('updated_at', { ascending: false });
        if (error) throw new Error(`Failed to list work orders: ${error.message}`);
        return (data ?? []) as WorkOrder[];
      },
      async getWorkOrderById(id: string) {
        const { data, error } = await supabase.from('work_orders').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(`Failed to fetch work order: ${error.message}`);
        return (data as WorkOrder | null) ?? null;
      },
      async createWorkOrder(input: WorkOrderInput) {
        const { data, error } = await supabase.from('work_orders').insert(input).select().single();
        if (error) throw new Error(`Failed to create work order: ${error.message}`);
        return data as WorkOrder;
      },
      async updateWorkOrder(id: string, updates: WorkOrderUpdate) {
        const { data, error } = await supabase.from('work_orders').update({
          ...updates,
          updated_at: new Date().toISOString(),
        }).eq('id', id).select().single();
        if (error) throw new Error(`Failed to update work order: ${error.message}`);
        return data as WorkOrder;
      },
      async assignWorkOrder(id: string, assigneeId: string, phoneNumber?: string | null) {
        const { data, error } = await supabase.from('work_orders').update({
          assigned_to_user_id: assigneeId,
          assignee_phone_number: phoneNumber ?? null,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        }).eq('id', id).select().single();
        if (error) throw new Error(`Failed to assign work order: ${error.message}`);
        return data as WorkOrder;
      },
      async updateWorkOrderStatus(id: string, status: WorkOrderStatus) {
        const { data, error } = await supabase.from('work_orders').update({
          status,
          updated_at: new Date().toISOString(),
        }).eq('id', id).select().single();
        if (error) throw new Error(`Failed to update work order status: ${error.message}`);
        return data as WorkOrder;
      },
      async createWorkOrderEvent(input: WorkOrderEventInput) {
        const insertPayload = {
          ...input,
          ...(input.created_at ? { created_at: input.created_at } : {}),
        };
        const { data, error } = await supabase.from('work_order_events').insert(insertPayload).select().single();
        if (error) throw new Error(`Failed to create work order event: ${error.message}`);
        return data as WorkOrderEvent;
      },
      async listWorkOrderEvents(workOrderId: string) {
        const { data, error } = await supabase.from('work_order_events').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false });
        if (error) throw new Error(`Failed to list work order events: ${error.message}`);
        return (data ?? []) as WorkOrderEvent[];
      },
    } satisfies WorkOrderRepository;
  }

  return new InMemoryWorkOrderRepository();
}
