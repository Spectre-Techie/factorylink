import type {
  InventoryAlert,
  InventoryAlertInput,
  InventoryAuditEventInput,
  InventoryContact,
  InventoryContactInput,
  InventoryItem,
  InventoryItemInput,
  InventoryRepository,
} from './inventoryRepository.js';

interface InventoryLowStockInput {
  quantity_available: number;
  reorder_threshold: number;
}

interface SmsProvider {
  sendSms(payload: Record<string, unknown>): Promise<{ ok: boolean; provider: string; type: string; message: string; requestId?: string; meta?: Record<string, unknown> }>;
}

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly provider: SmsProvider,
  ) {}

  isLowStock(item: InventoryLowStockInput): boolean {
    return Number(item.quantity_available) <= Number(item.reorder_threshold);
  }

  async listInventoryItems(organizationId: string): Promise<InventoryItem[]> {
    return this.repository.listInventoryItems(organizationId);
  }

  async getInventoryItemById(id: string, organizationId: string): Promise<InventoryItem | null> {
    return this.repository.getInventoryItemById(id, organizationId);
  }

  async createInventoryItem(input: InventoryItemInput, organizationId: string): Promise<InventoryItem> {
    const scopedOrganizationId = organizationId.trim();
    const sku = input.sku?.trim();
    const name = input.name?.trim();
    const unit = input.unit?.trim();

    if (!scopedOrganizationId || !sku || !name || !unit) {
      throw new Error('Inventory item requires sku, name, and unit.');
    }

    if (!Number.isFinite(input.quantity_available) || Number(input.quantity_available) < 0) {
      throw new Error('Inventory item quantity_available must be a non-negative number.');
    }

    if (!Number.isFinite(input.reorder_threshold) || Number(input.reorder_threshold) < 0) {
      throw new Error('Inventory item reorder_threshold must be a non-negative number.');
    }

    return this.repository.createInventoryItem({
      ...input,
      organization_id: scopedOrganizationId,
      sku,
      name,
      unit,
      status: input.status ?? 'active',
    });
  }

  async updateInventoryQuantity(id: string, quantity: number, organizationId: string): Promise<InventoryItem> {
    if (!id || !id.trim()) {
      throw new Error('Inventory item id is required.');
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('Inventory quantity must be a non-negative number.');
    }

    const currentItem = await this.repository.getInventoryItemById(id, organizationId);
    const updatedItem = await this.repository.updateInventoryQuantity(id, quantity, organizationId);
    const nextStatus = this.resolveStatus(updatedItem.quantity_available, updatedItem.reorder_threshold);

    if (currentItem && currentItem.status !== nextStatus) {
      await this.repository.createAuditEvent({
        organization_id: updatedItem.organization_id,
        inventory_item_id: updatedItem.id,
        event_type: 'inventory_status_changed',
        details: {
          item_id: updatedItem.id,
          previous_status: currentItem.status,
          new_status: nextStatus,
          quantity: updatedItem.quantity_available,
          threshold: updatedItem.reorder_threshold,
        },
      });
    }

    if (nextStatus === 'low_stock') {
      const itemResult = await this.processLowStockItem(updatedItem, organizationId);
      if (itemResult.processed > 0 || itemResult.failed > 0 || itemResult.skipped > 0) {
        return updatedItem;
      }
    }

    return updatedItem;
  }

  async listContacts(organizationId: string): Promise<InventoryContact[]> {
    return this.repository.listContacts(organizationId);
  }

  async createContact(input: InventoryContactInput, organizationId: string): Promise<InventoryContact> {
    const scopedOrganizationId = organizationId.trim();
    const name = input.name?.trim();
    const phoneNumber = input.phone_number?.trim();

    if (!scopedOrganizationId || !name || !phoneNumber) {
      throw new Error('Contact requires name and phone_number.');
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber.replace(/\s+/g, ''))) {
      throw new Error('Contact phone number must be a valid E.164 number, for example +254712345678.');
    }

    return this.repository.createContact({
      ...input,
      organization_id: scopedOrganizationId,
      name,
      phone_number: phoneNumber,
      channel: input.channel ?? 'sms',
      status: input.status ?? 'active',
    });
  }

  async listAlerts(organizationId: string): Promise<InventoryAlert[]> {
    return this.repository.listAlerts(organizationId);
  }

  private resolveStatus(quantityAvailable: number, reorderThreshold: number): 'active' | 'low_stock' {
    return Number(quantityAvailable) <= Number(reorderThreshold) ? 'low_stock' : 'active';
  }

  private async getLastStatusTransition(itemId: string, targetStatus: 'low_stock' | 'active', organizationId: string): Promise<number> {
    const events = await this.repository.listAuditEventsByItemId(itemId, organizationId);
    const transitionEvent = events
      .filter((event) => event.event_type === 'inventory_status_changed')
      .map((event) => ({
        created_at: new Date(event.created_at).getTime(),
        new_status: (event.details as Record<string, unknown>).new_status,
      }))
      .filter((event) => event.new_status === targetStatus)
      .sort((a, b) => b.created_at - a.created_at)[0];

    return transitionEvent?.created_at ?? 0;
  }

  async evaluateLowStockForItem(itemId: string, organizationId: string): Promise<{ processed: number; failed: number; skipped: number; alerts: InventoryAlert[] }> {
    const item = await this.repository.getInventoryItemById(itemId, organizationId);

    if (!item) {
      throw new Error('Inventory item not found.');
    }

    if (!this.isLowStock(item)) {
      return { processed: 0, failed: 0, skipped: 0, alerts: [] };
    }

    return this.processLowStockItem(item, organizationId);
  }

  async triggerLowStockAlerts(organizationId: string): Promise<{ processed: number; failed: number; skipped: number; alerts: InventoryAlert[] }> {
    const items = await this.repository.listInventoryItems(organizationId);
    const result = {
      processed: 0,
      failed: 0,
      skipped: 0,
      alerts: [] as InventoryAlert[],
    };

    for (const item of items) {
      if (!this.isLowStock(item)) {
        continue;
      }

      const itemResult = await this.processLowStockItem(item, organizationId);
      result.processed += itemResult.processed;
      result.failed += itemResult.failed;
      result.skipped += itemResult.skipped;
      result.alerts.push(...itemResult.alerts);
    }

    return result;
  }

  private async processLowStockItem(item: InventoryItem, organizationId: string): Promise<{ processed: number; failed: number; skipped: number; alerts: InventoryAlert[] }> {
    const recentAlert = await this.repository.getRecentAlert(item.id, organizationId);
    const recentAlertTime = recentAlert ? new Date(recentAlert.created_at).getTime() : 0;
    const lastLowStockTransition = await this.getLastStatusTransition(item.id, 'low_stock', organizationId);
    const lastActiveTransition = await this.getLastStatusTransition(item.id, 'active', organizationId);

    const shouldSkipDuplicate = Boolean(
      recentAlert && (
        recentAlertTime > 0 && (
          lastLowStockTransition === 0 || (lastLowStockTransition > lastActiveTransition && recentAlertTime >= lastLowStockTransition)
        )
      ),
    );

    if (shouldSkipDuplicate && recentAlert) {
      await this.repository.createAuditEvent({
        organization_id: item.organization_id,
        inventory_item_id: item.id,
        event_type: 'inventory_alert_skipped',
        details: {
          reason: 'duplicate_recent_alert',
          item_id: item.id,
          sku: item.sku,
          threshold: item.reorder_threshold,
          quantity: item.quantity_available,
          last_alert_at: recentAlert.created_at,
          last_low_stock_transition_at: lastLowStockTransition > 0 ? new Date(lastLowStockTransition).toISOString() : null,
          last_active_transition_at: lastActiveTransition > 0 ? new Date(lastActiveTransition).toISOString() : null,
        },
      });

      return { processed: 0, failed: 0, skipped: 1, alerts: [] };
    }

    const contacts = await this.repository.listContacts(organizationId);
    const activeContacts = contacts.filter(
      (contact) => contact.organization_id === item.organization_id && contact.status === 'active',
    );

    const alerts: InventoryAlert[] = [];
    let processed = 0;
    let failed = 0;
    const message = `Low stock alert: ${item.name} is at ${item.quantity_available} ${item.unit}. Reorder threshold is ${item.reorder_threshold} ${item.unit}.`;

    for (const contact of activeContacts) {
      const response = await this.provider.sendSms({
        recipient: contact.phone_number,
        message,
        senderId: 'FactoryLink',
      });

      const providerResponse: Record<string, unknown> = {
        provider: response.provider,
        type: response.type,
        requestId: response.requestId,
      };

      const alertStatus: 'sent' | 'failed' = response.ok ? 'sent' : 'failed';
      const alertInput: InventoryAlertInput = {
        organization_id: item.organization_id,
        inventory_item_id: item.id,
        contact_id: contact.id,
        alert_type: 'low_stock',
        status: alertStatus,
        message,
        provider_response: providerResponse,
      };

      const alert = await this.repository.createAlert(alertInput);
      alerts.push(alert);

      if (response.ok) {
        processed += 1;
      } else {
        failed += 1;
      }

      await this.repository.createAuditEvent({
        organization_id: item.organization_id,
        inventory_item_id: item.id,
        event_type: alertStatus === 'sent' ? 'inventory_alert_sent' : 'inventory_alert_failed',
        details: {
          item_id: item.id,
          sku: item.sku,
          quantity: item.quantity_available,
          threshold: item.reorder_threshold,
          contact_id: contact.id,
          contact_count: activeContacts.length,
          provider_response: providerResponse ?? null,
        },
      } satisfies InventoryAuditEventInput);
    }

    return {
      processed,
      failed,
      skipped: 0,
      alerts,
    };
  }
}
