import type { UssdRepository } from './ussdRepository.js';

export interface UssdCallback {
  sessionId: string;
  serviceCode?: string;
  phoneNumber?: string;
  text?: string;
}

interface SmsProvider {
  sendSms(payload: Record<string, unknown>): Promise<{ ok: boolean; provider: string; type: string; message: string; requestId?: string; meta?: Record<string, unknown> }>;
}

interface UssdSessionState {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  distributorId?: string;
  organizationId?: string;
  step: 'main' | 'product_list' | 'quantity_entry' | 'order_summary' | 'lookup_order' | 'stock_select' | 'sales_amount' | 'sales_confirm';
  productId?: string;
  quantity?: number;
  salesAmount?: number;
  invalidCounter: number;
}

export class UssdService {
  private readonly sessions = new Map<string, UssdSessionState>();

  constructor(
    private readonly config: {
      repository: UssdRepository;
      smsProvider: SmsProvider;
    },
  ) {}

  async processCallback(callback: UssdCallback): Promise<string> {
    const sessionId = callback.sessionId?.trim() || `ussd-${Date.now()}`;
    const phoneNumber = this.normalizePhone(callback.phoneNumber ?? '');
    const serviceCode = callback.serviceCode?.trim() || '*123#';

    if (!phoneNumber) {
      return 'END Invalid phone number.';
    }

    const distributor = await this.config.repository.findDistributorByPhone(phoneNumber);
    if (!distributor || distributor.status !== 'active') {
      return 'END Distributor not found.';
    }

    const session = this.getOrCreateSession(sessionId, phoneNumber, serviceCode);
    session.distributorId = distributor.id;
    session.organizationId = distributor.organization_id;

    const rawText = callback.text ?? '';
    const tokens = rawText.trim() ? rawText.split('*').map((part) => part.trim()).filter(Boolean) : [];

    if (session.step === 'main' && tokens.length > 0) {
      const menuChoice = tokens[0];

      if (menuChoice === '1') {
        if (tokens.length === 1) {
          session.step = 'product_list';
          return await this.renderProductList(distributor.organization_id);
        }

        const productSelection = tokens[1];
        const productResult = await this.handleProductSelection(session, productSelection);
        if (tokens.length <= 2) {
          return productResult;
        }

        const quantityResult = await this.handleQuantityInput(session, tokens[2] ?? '');
        if (tokens.length <= 3) {
          return quantityResult;
        }

        return await this.handleOrderSummary(session, tokens[3] ?? '');
      }

      if (menuChoice === '2') {
        if (tokens.length === 1) {
          session.step = 'lookup_order';
          return 'CON Enter order ID:';
        }

        return await this.lookupOrder(session, tokens.slice(1).join('*'));
      }

      if (menuChoice === '3') {
        if (tokens.length === 1) {
          session.step = 'stock_select';
          return await this.renderProductList(distributor.organization_id);
        }

        return await this.handleStockLookup(session, tokens[1] ?? '');
      }

      if (menuChoice === '4') {
        if (tokens.length === 1) {
          session.step = 'sales_amount';
          return 'CON Enter sales amount:';
        }

        const salesResult = this.handleSalesInput(session, tokens[1] ?? '');
        if (tokens.length <= 2) {
          return salesResult;
        }

        return await this.handleSalesConfirmation(session, tokens[2] ?? '');
      }

      if (menuChoice === '5') {
        this.sessions.delete(sessionId);
        return 'END Help: Place Order, My Orders, Check Stock, Report Sales.';
      }

      return 'CON Invalid selection. Please choose a number from 1 to 5.';
    }

    if (tokens.length === 0 && session.step === 'main') {
      return this.renderMainMenu();
    }

    switch (session.step) {
      case 'product_list': {
        return await this.handleProductSelection(session, tokens[tokens.length - 1] ?? '');
      }
      case 'quantity_entry': {
        return await this.handleQuantityInput(session, tokens[tokens.length - 1] ?? '');
      }
      case 'order_summary': {
        return await this.handleOrderSummary(session, tokens[tokens.length - 1] ?? '');
      }
      case 'lookup_order': {
        return await this.lookupOrder(session, tokens[tokens.length - 1] ?? '');
      }
      case 'stock_select': {
        return await this.handleStockLookup(session, tokens[tokens.length - 1] ?? '');
      }
      case 'sales_amount': {
        return this.handleSalesInput(session, tokens[tokens.length - 1] ?? '');
      }
      case 'sales_confirm': {
        return await this.handleSalesConfirmation(session, tokens[tokens.length - 1] ?? '');
      }
      default: {
        return 'CON Invalid selection. Please choose a number from 1 to 5.';
      }
    }
  }

  private getOrCreateSession(sessionId: string, phoneNumber: string, serviceCode: string): UssdSessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const next: UssdSessionState = {
      sessionId,
      phoneNumber,
      serviceCode,
      step: 'main',
      invalidCounter: 0,
    };

    this.sessions.set(sessionId, next);
    return next;
  }

  private renderMainMenu(): string {
    return 'CON Welcome to FactoryLink\n1. Place Order\n2. My Orders\n3. Check Stock\n4. Report Sales\n5. Help';
  }

  private async renderProductList(organizationId: string): Promise<string> {
    const products = await this.config.repository.listActiveProductsForOrganization(organizationId);

    if (products.length === 0) {
      return 'END No active products are available for your organization.';
    }

    const lines = products.map((product, index) => `${index + 1}. ${product.name}`);
    return `CON Select product:\n${lines.join('\n')}`;
  }

  private async handleProductSelection(session: UssdSessionState, rawChoice: string): Promise<string> {
    if (!session.organizationId) {
      return 'END Session invalid. Please start again.';
    }

    const productIndex = Number.parseInt(rawChoice, 10);
    const products = await this.config.repository.listActiveProductsForOrganization(session.organizationId);
    const product = products[productIndex - 1];

    if (!product) {
      return 'CON Invalid product selection. Please choose a valid product.';
    }

    session.productId = product.id;
    session.step = 'quantity_entry';
    return 'CON Enter quantity:';
  }

  private async handleQuantityInput(session: UssdSessionState, rawQuantity: string): Promise<string> {
    if (!session.organizationId || !session.productId) {
      return 'END Session invalid. Please start again.';
    }

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 'CON Invalid quantity. Enter a number greater than 0.';
    }

    const inventory = await this.config.repository.getInventoryForProduct(session.organizationId, session.productId);
    if (!inventory) {
      return 'END Product not found or unavailable in your organization.';
    }

    if (quantity > inventory.quantity_available) {
      return `END Insufficient stock. Available: ${inventory.quantity_available} ${inventory.unit}.`;
    }

    const product = await this.config.repository.getProductById(session.productId);
    if (!product) {
      return 'END Product not found.';
    }

    session.quantity = quantity;
    session.step = 'order_summary';
    return `CON Order:\nProduct: ${product.name}\nQuantity: ${quantity}\n\n1. Confirm\n2. Cancel`;
  }

  private async handleOrderSummary(session: UssdSessionState, rawChoice: string): Promise<string> {
    const choice = rawChoice.trim();

    if (!session.organizationId || !session.distributorId || !session.productId || typeof session.quantity !== 'number') {
      this.sessions.delete(session.sessionId);
      return 'END Session ended.';
    }

    if (choice === '1') {
      const product = await this.config.repository.getProductById(session.productId);
      if (!product) {
        this.sessions.delete(session.sessionId);
        return 'END Product not found.';
      }

      const inventory = await this.config.repository.getInventoryForProduct(session.organizationId, session.productId);
      if (!inventory || session.quantity > inventory.quantity_available) {
        this.sessions.delete(session.sessionId);
        return `END Insufficient stock. Available: ${inventory?.quantity_available ?? 0} ${inventory?.unit ?? 'pcs'}.`;
      }

      const orderNumber = `FL-${Math.floor(1000 + Math.random() * 9000)}`;
      const order = await this.config.repository.createOrder({
        organization_id: session.organizationId,
        distributor_id: session.distributorId,
        product_id: session.productId,
        quantity: session.quantity,
        status: 'pending',
        order_number: orderNumber,
      });

      const message = `FACTORYLINK\nOrder #${order.order_number ?? orderNumber} received.\nProduct: ${product.name}\nQuantity: ${session.quantity}\nStatus: Pending.`;
      await this.config.smsProvider.sendSms({
        recipient: session.phoneNumber,
        message,
        senderId: 'FactoryLink',
      });

      this.sessions.delete(session.sessionId);
      return `END Order #${order.order_number ?? orderNumber} created successfully.\nStatus: Pending.`;
    }

    if (choice === '2') {
      this.sessions.delete(session.sessionId);
      return 'END Order cancelled.';
    }

    return 'CON Invalid selection. Choose 1 to confirm or 2 to cancel.';
  }

  private async lookupOrder(session: UssdSessionState, orderNumber: string): Promise<string> {
    const normalizedOrderNumber = orderNumber.trim();
    if (!session.organizationId || !session.distributorId) {
      return 'END Distributor not found.';
    }

    if (!normalizedOrderNumber) {
      session.step = 'lookup_order';
      return 'CON Enter order ID:';
    }

    const order = await this.config.repository.getOrderByDistributorAndNumber(session.organizationId, session.distributorId, normalizedOrderNumber);
    if (!order) {
      this.sessions.delete(session.sessionId);
      return 'END Order not found.';
    }

    const product = await this.config.repository.getProductById(order.product_id);
    this.sessions.delete(session.sessionId);
    return `END Order #${order.order_number}\nProduct: ${product?.name ?? 'Unknown'}\nQuantity: ${order.quantity}\nStatus: ${this.titleCase(order.status)}`;
  }

  private async handleStockLookup(session: UssdSessionState, rawChoice: string): Promise<string> {
    if (!session.organizationId) {
      return 'END Session invalid. Please start again.';
    }

    const products = await this.config.repository.listActiveProductsForOrganization(session.organizationId);
    const productIndex = Number.parseInt(rawChoice, 10);
    const product = products[productIndex - 1];

    if (!product) {
      return 'CON Invalid product selection. Please choose a valid product.';
    }

    const inventory = await this.config.repository.getInventoryForProduct(session.organizationId, product.id);
    this.sessions.delete(session.sessionId);

    if (!inventory) {
      return `END Product ${product.name} is unavailable.`;
    }

    return `END Product: ${product.name}\nAvailable: ${inventory.quantity_available} ${inventory.unit}`;
  }

  private handleSalesInput(session: UssdSessionState, rawAmount: string): string {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      return 'CON Invalid sales amount. Enter a non-negative number.';
    }

    session.salesAmount = amount;
    session.step = 'sales_confirm';
    return `CON Sales amount:\nNGN ${amount}\n\n1. Confirm\n2. Cancel`;
  }

  private async handleSalesConfirmation(session: UssdSessionState, rawChoice: string): Promise<string> {
    if (rawChoice === '1' && typeof session.salesAmount === 'number' && session.organizationId && session.distributorId) {
      await this.config.repository.createSalesReport({
        organization_id: session.organizationId,
        distributor_id: session.distributorId,
        amount: session.salesAmount,
        status: 'submitted',
      });
      this.sessions.delete(session.sessionId);
      return 'END Sales report recorded.';
    }

    if (rawChoice === '2') {
      this.sessions.delete(session.sessionId);
      return 'END Sales report cancelled.';
    }

    return 'CON Invalid selection. Choose 1 to confirm or 2 to cancel.';
  }

  private titleCase(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private normalizePhone(phoneNumber: string): string {
    return (phoneNumber ?? '').replace(/\s+/g, '').trim();
  }
}
