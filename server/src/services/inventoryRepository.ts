import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type InventoryStatus = 'active' | 'low_stock' | 'archived';
export type ContactChannel = 'sms';
export type ContactStatus = 'active' | 'inactive';
export type AlertStatus = 'sent' | 'failed';

export interface InventoryItem {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  quantity_available: number;
  reorder_threshold: number;
  unit: string;
  status: InventoryStatus;
  updated_at: string;
}

export interface InventoryItemInput {
  organization_id: string;
  sku: string;
  name: string;
  quantity_available: number;
  reorder_threshold: number;
  unit: string;
  status?: InventoryStatus;
}

export interface InventoryContact {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string;
  channel: ContactChannel;
  status: ContactStatus;
  created_at: string;
}

export interface InventoryContactInput {
  organization_id: string;
  name: string;
  phone_number: string;
  channel?: ContactChannel;
  status?: ContactStatus;
}

export interface InventoryAlert {
  id: string;
  organization_id: string;
  inventory_item_id: string;
  contact_id?: string;
  alert_type: 'low_stock';
  status: AlertStatus;
  message: string;
  provider_response?: Record<string, unknown>;
  created_at: string;
}

export interface InventoryAlertInput {
  organization_id: string;
  inventory_item_id: string;
  contact_id?: string;
  alert_type: 'low_stock';
  status: AlertStatus;
  message: string;
  provider_response?: Record<string, unknown>;
}

export interface InventoryAuditEvent {
  id: string;
  organization_id: string;
  inventory_item_id?: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface InventoryAuditEventInput {
  organization_id: string;
  inventory_item_id?: string;
  event_type: string;
  details: Record<string, unknown>;
}

export interface InventoryRepository {
  listInventoryItems(organizationId: string): Promise<InventoryItem[]>;
  getInventoryItemById(id: string, organizationId: string): Promise<InventoryItem | null>;
  createInventoryItem(input: InventoryItemInput): Promise<InventoryItem>;
  updateInventoryQuantity(id: string, quantity: number, organizationId: string): Promise<InventoryItem>;
  listContacts(organizationId: string): Promise<InventoryContact[]>;
  createContact(input: InventoryContactInput): Promise<InventoryContact>;
  listAlerts(organizationId: string): Promise<InventoryAlert[]>;
  getRecentAlert(inventoryItemId: string, organizationId: string): Promise<InventoryAlert | null>;
  createAlert(input: InventoryAlertInput): Promise<InventoryAlert>;
  listAuditEventsByItemId(itemId: string, organizationId: string): Promise<InventoryAuditEvent[]>;
  createAuditEvent(input: InventoryAuditEventInput): Promise<InventoryAuditEvent>;
}

class InMemoryInventoryRepository implements InventoryRepository {
  private inventoryItems: InventoryItem[] = [
    {
      id: 'inv-demo-1',
      organization_id: 'org-demo',
      sku: 'BOLT-01',
      name: 'Bolt Kit',
      quantity_available: 3,
      reorder_threshold: 5,
      unit: 'pcs',
      status: 'low_stock',
      updated_at: new Date().toISOString(),
    },
  ];

  private contacts: InventoryContact[] = [
    {
      id: 'contact-demo-1',
      organization_id: 'org-demo',
      name: 'Ops Lead',
      phone_number: '+254712345678',
      channel: 'sms',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  private alerts: InventoryAlert[] = [];

  private auditEvents: InventoryAuditEvent[] = [];

  async listInventoryItems(organizationId: string): Promise<InventoryItem[]> {
    return this.inventoryItems.filter((item) => item.organization_id === organizationId);
  }

  async getInventoryItemById(id: string, organizationId: string): Promise<InventoryItem | null> {
    return this.inventoryItems.find((item) => item.id === id && item.organization_id === organizationId) ?? null;
  }

  async createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
    const item: InventoryItem = {
      id: `inv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      sku: input.sku,
      name: input.name,
      quantity_available: input.quantity_available,
      reorder_threshold: input.reorder_threshold,
      unit: input.unit,
      status: input.status ?? 'active',
      updated_at: new Date().toISOString(),
    };

    this.inventoryItems.unshift(item);
    return item;
  }

  async updateInventoryQuantity(id: string, quantity: number, organizationId: string): Promise<InventoryItem> {
    const item = this.inventoryItems.find((entry) => entry.id === id && entry.organization_id === organizationId);

    if (!item) {
      throw new Error(`Inventory item not found: ${id}`);
    }

    item.quantity_available = quantity;
    item.status = quantity <= item.reorder_threshold ? 'low_stock' : 'active';
    item.updated_at = new Date().toISOString();

    return item;
  }

  async listAuditEventsByItemId(itemId: string, organizationId: string): Promise<InventoryAuditEvent[]> {
    return [...this.auditEvents].filter((event) => event.inventory_item_id === itemId && event.organization_id === organizationId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async listContacts(organizationId: string): Promise<InventoryContact[]> {
    return this.contacts.filter((contact) => contact.organization_id === organizationId);
  }

  async createContact(input: InventoryContactInput): Promise<InventoryContact> {
    const contact: InventoryContact = {
      id: `contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      name: input.name,
      phone_number: input.phone_number,
      channel: input.channel ?? 'sms',
      status: input.status ?? 'active',
      created_at: new Date().toISOString(),
    };

    this.contacts.unshift(contact);
    return contact;
  }

  async listAlerts(organizationId: string): Promise<InventoryAlert[]> {
    return this.alerts.filter((alert) => alert.organization_id === organizationId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getRecentAlert(inventoryItemId: string, organizationId: string): Promise<InventoryAlert | null> {
    const matches = this.alerts.filter((item) => item.inventory_item_id === inventoryItemId && item.organization_id === organizationId);
    return matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  }

  async createAlert(input: InventoryAlertInput): Promise<InventoryAlert> {
    const alert: InventoryAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      inventory_item_id: input.inventory_item_id,
      contact_id: input.contact_id,
      alert_type: input.alert_type,
      status: input.status,
      message: input.message,
      provider_response: input.provider_response,
      created_at: new Date().toISOString(),
    };

    this.alerts.unshift(alert);
    return alert;
  }

  async createAuditEvent(input: InventoryAuditEventInput): Promise<InventoryAuditEvent> {
    const event: InventoryAuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      inventory_item_id: input.inventory_item_id,
      event_type: input.event_type,
      details: input.details,
      created_at: new Date().toISOString(),
    };

    this.auditEvents.unshift(event);
    return event;
  }
}

export function createInventoryRepository(): InventoryRepository {
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
      async listInventoryItems(organizationId) {
        const { data, error } = await supabase.from('inventory_items').select('*').eq('organization_id', organizationId);
        if (error) throw new Error(`Failed to list inventory items: ${error.message}`);
        return (data ?? []) as InventoryItem[];
      },
      async getInventoryItemById(id: string, organizationId: string) {
        const { data, error } = await supabase.from('inventory_items').select('*').eq('id', id).eq('organization_id', organizationId).maybeSingle();
        if (error) throw new Error(`Failed to fetch inventory item: ${error.message}`);
        return (data as InventoryItem | null) ?? null;
      },
      async createInventoryItem(input: InventoryItemInput) {
        const { data, error } = await supabase.from('inventory_items').insert(input).select().single();
        if (error) throw new Error(`Failed to create inventory item: ${error.message}`);
        return data as InventoryItem;
      },
      async updateInventoryQuantity(id: string, quantity: number, organizationId: string) {
        const currentItemResult = await supabase.from('inventory_items').select('*').eq('id', id).eq('organization_id', organizationId).maybeSingle();
        if (currentItemResult.error) throw new Error(`Failed to fetch inventory item: ${currentItemResult.error.message}`);

        const currentItem = currentItemResult.data as InventoryItem | null;
        if (!currentItem) throw new Error(`Inventory item not found: ${id}`);

        const nextStatus = quantity <= currentItem.reorder_threshold ? 'low_stock' : 'active';
        const { data, error } = await supabase.from('inventory_items').update({
          quantity_available: quantity,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('organization_id', organizationId).select().single();

        if (error) throw new Error(`Failed to update inventory quantity: ${error.message}`);
        return data as InventoryItem;
      },
      async listContacts(organizationId: string) {
        const { data, error } = await supabase.from('contacts').select('*').eq('organization_id', organizationId);
        if (error) throw new Error(`Failed to list contacts: ${error.message}`);
        return (data ?? []) as InventoryContact[];
      },
      async createContact(input: InventoryContactInput) {
        const { data, error } = await supabase.from('contacts').insert(input).select().single();
        if (error) throw new Error(`Failed to create contact: ${error.message}`);
        return data as InventoryContact;
      },
      async listAlerts(organizationId: string) {
        const { data, error } = await supabase.from('inventory_alerts').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
        if (error) throw new Error(`Failed to list alerts: ${error.message}`);
        return (data ?? []) as InventoryAlert[];
      },
      async getRecentAlert(inventoryItemId: string, organizationId: string) {
        const { data, error } = await supabase.from('inventory_alerts').select('*').eq('inventory_item_id', inventoryItemId).eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw new Error(`Failed to fetch alert: ${error.message}`);
        return (data as InventoryAlert | null) ?? null;
      },
      async createAlert(input: InventoryAlertInput) {
        const { data, error } = await supabase.from('inventory_alerts').insert(input).select().single();
        if (error) throw new Error(`Failed to create alert: ${error.message}`);
        return data as InventoryAlert;
      },
      async listAuditEventsByItemId(itemId: string, organizationId: string) {
        const { data, error } = await supabase.from('inventory_audit_events').select('*').eq('inventory_item_id', itemId).eq('organization_id', organizationId).order('created_at', { ascending: false });
        if (error) throw new Error(`Failed to list audit events: ${error.message}`);
        return (data ?? []) as InventoryAuditEvent[];
      },
      async createAuditEvent(input: InventoryAuditEventInput) {
        const { data, error } = await supabase.from('inventory_audit_events').insert(input).select().single();
        if (error) throw new Error(`Failed to create audit event: ${error.message}`);
        return data as InventoryAuditEvent;
      },
    } satisfies InventoryRepository;
  }

  return new InMemoryInventoryRepository();
}

export type InventoryPersistenceClient = SupabaseClient | null;
