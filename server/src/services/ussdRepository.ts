import { createClient } from '@supabase/supabase-js';

export interface DistributorRecord {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProductRecord {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySnapshot {
  organization_id: string;
  sku: string;
  quantity_available: number;
  unit: string;
}

export interface UssdOrderRecord {
  id: string;
  order_number: string;
  organization_id: string;
  distributor_id: string;
  product_id: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
  product_name?: string;
}

export interface SalesReportRecord {
  id: string;
  organization_id: string;
  distributor_id: string;
  amount: number;
  status: 'submitted' | 'rejected';
  created_at: string;
}

export interface UssdRepository {
  findDistributorByPhone(phoneNumber: string): Promise<DistributorRecord | null>;
  findDistributorById(distributorId: string): Promise<DistributorRecord | null>;
  listActiveProductsForOrganization(organizationId: string): Promise<ProductRecord[]>;
  getProductById(productId: string): Promise<ProductRecord | null>;
  getInventoryForProduct(organizationId: string, productId: string): Promise<InventorySnapshot | null>;
  createOrder(input: {
    organization_id: string;
    distributor_id: string;
    product_id: string;
    quantity: number;
    status?: 'pending' | 'confirmed' | 'cancelled';
    order_number?: string;
  }): Promise<UssdOrderRecord>;
  getOrderByDistributorAndNumber(organizationId: string, distributorId: string, orderNumber: string): Promise<UssdOrderRecord | null>;
  createSalesReport(input: {
    organization_id: string;
    distributor_id: string;
    amount: number;
    status?: 'submitted' | 'rejected';
  }): Promise<SalesReportRecord>;
}

class InMemoryUssdRepository implements UssdRepository {
  private readonly distributors: DistributorRecord[] = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      organization_id: '11111111-1111-4111-8111-111111111111',
      name: 'Phase 6 Distributor',
      phone_number: '+254700000001',
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ];

  private readonly products: ProductRecord[] = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      organization_id: '11111111-1111-4111-8111-111111111111',
      sku: 'PHASE6-A',
      name: 'Phase 6 Product A',
      unit: 'pcs',
      active: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      organization_id: '11111111-1111-4111-8111-111111111111',
      sku: 'PHASE6-B',
      name: 'Phase 6 Product B',
      unit: 'pcs',
      active: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ];

  private readonly inventoryByProductId: Record<string, InventorySnapshot> = {
    '33333333-3333-4333-8333-333333333333': {
      organization_id: '11111111-1111-4111-8111-111111111111',
      sku: 'PHASE6-A',
      quantity_available: 1250,
      unit: 'pcs',
    },
    '44444444-4444-4444-8444-444444444444': {
      organization_id: '11111111-1111-4111-8111-111111111111',
      sku: 'PHASE6-B',
      quantity_available: 25,
      unit: 'pcs',
    },
  };

  private readonly orders: UssdOrderRecord[] = [];

  private readonly salesReports: SalesReportRecord[] = [];

  async findDistributorByPhone(phoneNumber: string): Promise<DistributorRecord | null> {
    const normalized = this.normalizePhone(phoneNumber);
    return this.distributors.find((distributor) => this.normalizePhone(distributor.phone_number) === normalized) ?? null;
  }

  async findDistributorById(distributorId: string): Promise<DistributorRecord | null> {
    return this.distributors.find((distributor) => distributor.id === distributorId) ?? null;
  }

  async listActiveProductsForOrganization(organizationId: string): Promise<ProductRecord[]> {
    return this.products.filter((product) => product.organization_id === organizationId && product.active);
  }

  async getProductById(productId: string): Promise<ProductRecord | null> {
    return this.products.find((product) => product.id === productId) ?? null;
  }

  async getInventoryForProduct(organizationId: string, productId: string): Promise<InventorySnapshot | null> {
    const product = await this.getProductById(productId);
    if (!product || product.organization_id !== organizationId || !product.active) {
      return null;
    }
    return this.inventoryByProductId[productId] ?? null;
  }

  private generateOrderNumber(): string {
    const value = 1000 + Math.floor(Math.random() * 9000);
    return `FL-${value}`;
  }

  async createOrder(input: {
    organization_id: string;
    distributor_id: string;
    product_id: string;
    quantity: number;
    status?: 'pending' | 'confirmed' | 'cancelled';
    order_number?: string;
  }): Promise<UssdOrderRecord> {
    const orderNumber = input.order_number ?? this.generateOrderNumber();
    const record: UssdOrderRecord = {
      id: `order-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      order_number: orderNumber,
      organization_id: input.organization_id,
      distributor_id: input.distributor_id,
      product_id: input.product_id,
      quantity: input.quantity,
      status: input.status ?? 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      product_name: (await this.getProductById(input.product_id))?.name,
    };
    this.orders.unshift(record);
    return record;
  }

  async getOrderByDistributorAndNumber(organizationId: string, distributorId: string, orderNumber: string): Promise<UssdOrderRecord | null> {
    const matches = this.orders.filter((order) => order.organization_id === organizationId && order.distributor_id === distributorId && order.order_number.toLowerCase() === orderNumber.toLowerCase());
    return matches[0] ?? null;
  }

  async createSalesReport(input: {
    organization_id: string;
    distributor_id: string;
    amount: number;
    status?: 'submitted' | 'rejected';
  }): Promise<SalesReportRecord> {
    const record: SalesReportRecord = {
      id: `sales-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      organization_id: input.organization_id,
      distributor_id: input.distributor_id,
      amount: Number(input.amount),
      status: input.status ?? 'submitted',
      created_at: new Date().toISOString(),
    };
    this.salesReports.unshift(record);
    return record;
  }

  private normalizePhone(phoneNumber: string): string {
    return (phoneNumber ?? '').replace(/\s+/g, '').trim();
  }
}

export function createUssdRepository(): UssdRepository {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (url && serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    return {
      async findDistributorByPhone(phoneNumber: string) {
        const { data, error } = await supabase.from('distributor_profiles').select('*').eq('phone_number', phoneNumber).maybeSingle();
        if (error) throw new Error(`Failed to find distributor: ${error.message}`);
        return (data as DistributorRecord | null) ?? null;
      },
      async findDistributorById(distributorId: string) {
        const { data, error } = await supabase.from('distributor_profiles').select('*').eq('id', distributorId).maybeSingle();
        if (error) throw new Error('Unable to resolve distributor.');
        return (data as DistributorRecord | null) ?? null;
      },
      async listActiveProductsForOrganization(organizationId: string) {
        const { data, error } = await supabase.from('products').select('*').eq('organization_id', organizationId).eq('active', true).order('name', { ascending: true });
        if (error) throw new Error(`Failed to load products: ${error.message}`);
        return (data as ProductRecord[] | null) ?? [];
      },
      async getProductById(productId: string) {
        const { data, error } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
        if (error) throw new Error(`Failed to load product: ${error.message}`);
        return (data as ProductRecord | null) ?? null;
      },
      async getInventoryForProduct(organizationId: string, productId: string) {
        const { data, error } = await supabase.from('inventory_items').select('organization_id, sku, quantity_available, unit').eq('organization_id', organizationId).eq('id', productId).maybeSingle();
        if (error) throw new Error(`Failed to load inventory: ${error.message}`);
        return (data as InventorySnapshot | null) ?? null;
      },
      async createOrder(input) {
        const orderNumber = input.order_number ?? `FL-${Date.now()}`;
        const { data, error } = await supabase.from('ussd_orders').insert({
          organization_id: input.organization_id,
          distributor_id: input.distributor_id,
          product_id: input.product_id,
          quantity: input.quantity,
          status: input.status ?? 'pending',
          order_number: orderNumber,
        }).select().single();
        if (error) throw new Error(`Failed to create order: ${error.message}`);
        return data as UssdOrderRecord;
      },
      async getOrderByDistributorAndNumber(organizationId: string, distributorId: string, orderNumber: string) {
        const { data, error } = await supabase.from('ussd_orders').select('*').eq('organization_id', organizationId).eq('distributor_id', distributorId).eq('order_number', orderNumber).maybeSingle();
        if (error) throw new Error(`Failed to lookup order: ${error.message}`);
        return (data as UssdOrderRecord | null) ?? null;
      },
      async createSalesReport(input) {
        const { data, error } = await supabase.from('sales_reports').insert({
          organization_id: input.organization_id,
          distributor_id: input.distributor_id,
          amount: input.amount,
          status: input.status ?? 'submitted',
        }).select().single();
        if (error) throw new Error(`Failed to create sales report: ${error.message}`);
        return data as SalesReportRecord;
      },
    } satisfies UssdRepository;
  }

  return new InMemoryUssdRepository();
}
