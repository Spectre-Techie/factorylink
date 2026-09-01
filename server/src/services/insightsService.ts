import type { AppUser } from './authService.js';
import type { AirtimeReward } from './airtimeRepository.js';
import type { InventoryAlert, InventoryItem } from './inventoryRepository.js';
import type { WorkOrder, WorkOrderEvent } from './workOrderRepository.js';
import type { SalesReportRecord } from './ussdRepository.js';

export type InsightPriority = 'critical' | 'attention' | 'healthy';

export interface OperationalInsights {
  summary: {
    totalActiveWorkOrders: number;
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    overdue: number;
    unassignedPending: number;
  };
  inventoryRisk: {
    lowStockItems: number;
    criticalAlerts: number;
    failedAlerts: number;
    topItems: Array<{ id: string; name: string; quantityAvailable: number; reorderThreshold: number; unit: string }>;
  };
  workforce: { assigned: number; inProgress: number; completed: number };
  distributorPerformance: {
    totalSalesReports: number;
    totalReportedAmount: number;
    eligibleRewards: number;
    totalRewardValue: number;
    failedRewards: number;
  };
  attention: Array<{ priority: InsightPriority; category: string; title: string; message: string }>;
}

export interface InsightsDataSource {
  listWorkOrders(): Promise<WorkOrder[]>;
  listWorkOrderEvents(workOrderId: string): Promise<WorkOrderEvent[]>;
  listInventoryItems(): Promise<InventoryItem[]>;
  listInventoryAlerts(): Promise<InventoryAlert[]>;
  listSalesReportsForOrganization(organizationId: string): Promise<SalesReportRecord[]>;
  listRewardsForOrganization(organizationId: string): Promise<AirtimeReward[]>;
}

const priorityRank: Record<InsightPriority, number> = { critical: 0, attention: 1, healthy: 2 };

export async function getOperationalInsights(user: AppUser, source: InsightsDataSource, now = new Date()): Promise<OperationalInsights> {
  if (!['manager', 'operations'].includes(user.role)) {
    throw new Error('Operational insights access denied.');
  }

  const [allWorkOrders, inventoryItems, inventoryAlerts, salesReports, rewards] = await Promise.all([
    source.listWorkOrders(),
    source.listInventoryItems(),
    source.listInventoryAlerts(),
    source.listSalesReportsForOrganization(user.organization_id),
    source.listRewardsForOrganization(user.organization_id),
  ]);
  const workOrders = allWorkOrders.filter((workOrder) => workOrder.organization_id === user.organization_id);
  const items = inventoryItems.filter((item) => item.organization_id === user.organization_id);
  const alerts = inventoryAlerts.filter((alert) => alert.organization_id === user.organization_id);
  const lowStock = items.filter((item) => item.quantity_available <= item.reorder_threshold);
  const overdue = workOrders.filter((workOrder) => workOrder.status !== 'completed' && workOrder.due_at !== null && new Date(workOrder.due_at).getTime() < now.getTime());
  const unassignedPending = workOrders.filter((workOrder) => workOrder.status === 'pending' && workOrder.assigned_to_user_id === null);
  const failedAlerts = alerts.filter((alert) => alert.status === 'failed');
  const failedRewards = rewards.filter((reward) => reward.status === 'failed');
  const workOrderEvents = (await Promise.all(workOrders.map((workOrder) => source.listWorkOrderEvents(workOrder.id)))).flat()
    .filter((event) => event.organization_id === user.organization_id && workOrders.some((workOrder) => workOrder.id === event.work_order_id));
  const failedNotificationEvents = workOrderEvents.filter((event) => event.event_type === 'work_order_notification_failed');
  const attention: OperationalInsights['attention'] = [];

  for (const workOrder of overdue) {
    attention.push({ priority: 'critical', category: 'work_order', title: workOrder.title, message: 'Overdue work order requires immediate attention.' });
  }
  for (const item of lowStock) {
    attention.push({ priority: 'critical', category: 'inventory', title: item.name, message: `Stock is ${item.quantity_available} ${item.unit}; reorder threshold is ${item.reorder_threshold} ${item.unit}.` });
  }
  for (const workOrder of unassignedPending) {
    attention.push({ priority: 'attention', category: 'work_order', title: workOrder.title, message: 'Pending work order has no assigned technician.' });
  }
  for (const reward of failedRewards) {
    attention.push({ priority: 'attention', category: 'airtime_reward', title: 'Airtime reward failed', message: `Reward for distributor ${reward.distributor_id} requires review.` });
  }
  for (const alert of failedAlerts) {
    attention.push({ priority: 'attention', category: 'inventory_alert', title: 'Inventory alert failed', message: alert.message });
  }
  for (const event of failedNotificationEvents) {
    attention.push({ priority: 'attention', category: 'work_order_notification', title: 'Work-order notification failed', message: `Notification for work order ${event.work_order_id} requires review.` });
  }
  for (const workOrder of workOrders.filter((entry) => entry.status === 'completed').slice(0, 3)) {
    attention.push({ priority: 'healthy', category: 'work_order', title: workOrder.title, message: 'Work order completed successfully.' });
  }
  for (const reward of rewards.filter((entry) => entry.status === 'sent').slice(0, 3)) {
    attention.push({ priority: 'healthy', category: 'airtime_reward', title: 'Airtime reward sent', message: `NGN ${reward.amount} reward sent successfully.` });
  }
  attention.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);

  const submittedReports = salesReports.filter((report) => report.status === 'submitted');
  return {
    summary: {
      totalActiveWorkOrders: workOrders.filter((workOrder) => workOrder.status !== 'completed').length,
      pending: workOrders.filter((workOrder) => workOrder.status === 'pending').length,
      assigned: workOrders.filter((workOrder) => workOrder.status === 'assigned').length,
      inProgress: workOrders.filter((workOrder) => workOrder.status === 'in_progress').length,
      completed: workOrders.filter((workOrder) => workOrder.status === 'completed').length,
      overdue: overdue.length,
      unassignedPending: unassignedPending.length,
    },
    inventoryRisk: {
      lowStockItems: lowStock.length,
      criticalAlerts: lowStock.length,
      failedAlerts: failedAlerts.length,
      topItems: [...lowStock].sort((left, right) => {
        const leftRatio = left.reorder_threshold === 0 ? left.quantity_available : left.quantity_available / left.reorder_threshold;
        const rightRatio = right.reorder_threshold === 0 ? right.quantity_available : right.quantity_available / right.reorder_threshold;
        return leftRatio - rightRatio || left.quantity_available - right.quantity_available;
      }).slice(0, 5).map((item) => ({ id: item.id, name: item.name, quantityAvailable: item.quantity_available, reorderThreshold: item.reorder_threshold, unit: item.unit })),
    },
    workforce: {
      assigned: workOrders.filter((workOrder) => workOrder.status === 'assigned').length,
      inProgress: workOrders.filter((workOrder) => workOrder.status === 'in_progress').length,
      completed: workOrders.filter((workOrder) => workOrder.status === 'completed').length,
    },
    distributorPerformance: {
      totalSalesReports: submittedReports.length,
      totalReportedAmount: submittedReports.reduce((total, report) => total + Number(report.amount), 0),
      eligibleRewards: rewards.length,
      totalRewardValue: rewards.reduce((total, reward) => total + Number(reward.amount), 0),
      failedRewards: failedRewards.length,
    },
    attention: attention.slice(0, 20),
  };
}