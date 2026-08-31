import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderRepository,
  WorkOrderStatus,
} from './workOrderRepository.js';

interface SmsProvider {
  sendSms(payload: Record<string, unknown>): Promise<{ ok: boolean; provider: string; type: string; message: string; requestId?: string; meta?: Record<string, unknown> }>;
}

const VALID_WORK_ORDER_STATUSES = ['pending', 'assigned', 'in_progress', 'completed'] as const;
const VALID_WORK_ORDER_PRIORITIES = ['low', 'medium', 'high'] as const;

export class WorkOrderService {
  constructor(
    private readonly repository: WorkOrderRepository,
    private readonly provider: SmsProvider,
  ) {}

  private assertValidPriority(priority: string): asserts priority is (typeof VALID_WORK_ORDER_PRIORITIES)[number] {
    if (!VALID_WORK_ORDER_PRIORITIES.includes(priority as (typeof VALID_WORK_ORDER_PRIORITIES)[number])) {
      throw new Error('Work order priority must be low, medium, or high.');
    }
  }

  private assertValidStatus(status: string): asserts status is WorkOrderStatus {
    if (!VALID_WORK_ORDER_STATUSES.includes(status as WorkOrderStatus)) {
      throw new Error('Invalid work order status.');
    }
  }

  async createWorkOrder(input: Partial<WorkOrderInput>): Promise<WorkOrder> {
    if (!input.organization_id || !String(input.organization_id).trim()) {
      throw new Error('Work order organization_id is required.');
    }

    if (!input.title || !String(input.title).trim()) {
      throw new Error('Work order title is required.');
    }

    if (!input.description || !String(input.description).trim()) {
      throw new Error('Work order description is required.');
    }

    if (!input.priority) {
      throw new Error('Work order priority is required.');
    }

    this.assertValidPriority(String(input.priority));

    const workOrder = await this.repository.createWorkOrder({
      organization_id: String(input.organization_id).trim(),
      site_id: input.site_id ?? null,
      title: String(input.title).trim(),
      description: String(input.description).trim(),
      priority: String(input.priority) as (typeof VALID_WORK_ORDER_PRIORITIES)[number],
      status: input.status ?? 'pending',
      created_by_user_id: input.created_by_user_id ?? null,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      assignee_phone_number: input.assignee_phone_number ?? null,
      due_at: input.due_at ?? null,
    });

    await this.repository.createWorkOrderEvent({
      organization_id: workOrder.organization_id,
      work_order_id: workOrder.id,
      actor_user_id: workOrder.created_by_user_id,
      event_type: 'work_order_created',
      details: {
        title: workOrder.title,
        priority: workOrder.priority,
        status: workOrder.status,
      },
    });

    return workOrder;
  }

  async listWorkOrders(): Promise<WorkOrder[]> {
    return this.repository.listWorkOrders();
  }

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    return this.repository.getWorkOrderById(id);
  }

  async updateWorkOrder(id: string, updates: Record<string, unknown>): Promise<WorkOrder> {
    const workOrder = await this.repository.getWorkOrderById(id);
    if (!workOrder) {
      throw new Error('Work order not found.');
    }

    const next: Record<string, unknown> = {};
    if (updates.title !== undefined) next.title = String(updates.title).trim();
    if (updates.description !== undefined) next.description = String(updates.description).trim();
    if (updates.priority !== undefined) {
      this.assertValidPriority(String(updates.priority));
      next.priority = String(updates.priority);
    }
    if (updates.status !== undefined) {
      this.assertValidStatus(String(updates.status));
      next.status = String(updates.status);
    }
    if (updates.site_id !== undefined) next.site_id = updates.site_id ?? null;
    if (updates.assigned_to_user_id !== undefined) next.assigned_to_user_id = updates.assigned_to_user_id ?? null;
    if (updates.assignee_phone_number !== undefined) next.assignee_phone_number = updates.assignee_phone_number ?? null;
    if (updates.due_at !== undefined) next.due_at = updates.due_at ?? null;

    return this.repository.updateWorkOrder(id, next as never);
  }

  async assignWorkOrder(id: string, assigneeId: string, phoneNumber?: string | null): Promise<WorkOrder> {
    const workOrder = await this.repository.getWorkOrderById(id);
    if (!workOrder) {
      throw new Error('Work order not found.');
    }

    if (!assigneeId || !String(assigneeId).trim()) {
      throw new Error('Assignee id is required.');
    }

    const assigned = await this.repository.assignWorkOrder(id, String(assigneeId).trim(), phoneNumber ?? null);

    await this.repository.createWorkOrderEvent({
      organization_id: workOrder.organization_id,
      work_order_id: id,
      actor_user_id: assigneeId,
      event_type: 'work_order_assigned',
      details: {
        assignee_id: assigneeId,
        assignee_phone_number: phoneNumber ?? assigned.assignee_phone_number ?? null,
        assigned_status: assigned.status,
      },
    });

    if (phoneNumber || assigned.assignee_phone_number) {
      const response = await this.provider.sendSms({
        recipient: phoneNumber ?? assigned.assignee_phone_number,
        message: `Work order assigned: ${assigned.title}. Status: ${assigned.status}.`,
        senderId: 'FactoryLink',
      });

      if (!response.ok) {
        await this.repository.createWorkOrderEvent({
          organization_id: workOrder.organization_id,
          work_order_id: id,
          actor_user_id: assigneeId,
          event_type: 'work_order_notification_failed',
          details: {
            provider: response.provider,
            type: response.type,
            message: response.message,
            requestId: response.requestId ?? null,
          },
        });
      }
    }

    return assigned;
  }

  async updateWorkOrderStatus(id: string, status: string): Promise<WorkOrder> {
    const workOrder = await this.repository.getWorkOrderById(id);
    if (!workOrder) {
      throw new Error('Work order not found.');
    }

    this.assertValidStatus(String(status));

    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      pending: ['assigned', 'in_progress'],
      assigned: ['in_progress', 'completed'],
      in_progress: ['completed'],
      completed: [],
    };

    if (!validTransitions[workOrder.status].includes(String(status) as WorkOrderStatus)) {
      throw new Error(`Invalid work order status transition from ${workOrder.status} to ${status}.`);
    }

    const updated = await this.repository.updateWorkOrderStatus(id, String(status) as WorkOrderStatus);

    await this.repository.createWorkOrderEvent({
      organization_id: workOrder.organization_id,
      work_order_id: id,
      actor_user_id: workOrder.assigned_to_user_id ?? workOrder.created_by_user_id,
      event_type: 'work_order_status_changed',
      details: {
        previous_status: workOrder.status,
        new_status: updated.status,
      },
    });

    if (updated.assignee_phone_number) {
      const response = await this.provider.sendSms({
        recipient: updated.assignee_phone_number,
        message: `Work order status update: ${updated.title}. Status: ${updated.status}.`,
        senderId: 'FactoryLink',
      });

      if (!response.ok) {
        await this.repository.createWorkOrderEvent({
          organization_id: workOrder.organization_id,
          work_order_id: id,
          actor_user_id: updated.assigned_to_user_id ?? null,
          event_type: 'work_order_notification_failed',
          details: {
            provider: response.provider,
            type: response.type,
            message: response.message,
            requestId: response.requestId ?? null,
          },
        });
      }
    }

    return updated;
  }
}
