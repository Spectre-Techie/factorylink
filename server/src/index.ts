import express, { NextFunction, Request, Response } from 'express';

import { assertServerConfig, config } from './config.js';
import { AuthService, type AppUser } from './services/authService.js';
import { createAuthRepository } from './services/authRepository.js';
import { createAfricaTalkingProvider } from './services/africastalking/provider.js';
import { createInventoryRepository } from './services/inventoryRepository.js';
import { InventoryService } from './services/inventoryService.js';
import { createWorkOrderRepository } from './services/workOrderRepository.js';
import { canUserAccessWorkOrder, filterWorkOrdersForUser, getDashboardSummary } from './services/dashboardService.js';
import { WorkOrderService } from './services/workOrderService.js';
import { UssdService } from './services/ussdService.js';
import { createUssdRepository } from './services/ussdRepository.js';
import { VoiceService } from './services/voiceService.js';
import { AirtimeService } from './services/airtimeService.js';
import { createAirtimeRewardRepository } from './services/airtimeRepository.js';
import { getOperationalInsights } from './services/insightsService.js';

assertServerConfig();

declare module 'express' {
  interface Request {
    user?: AppUser;
  }
}

const app = express();
const port = config.port;
const authService = new AuthService(createAuthRepository());
const africaTalkingProvider = createAfricaTalkingProvider(config.africaTalking);
const inventoryRepository = createInventoryRepository();
const workOrderRepository = createWorkOrderRepository();
const inventoryService = new InventoryService(inventoryRepository, {
  async sendSms(payload) {
    return africaTalkingProvider.sendSms(payload);
  },
});
const workOrderService = new WorkOrderService(workOrderRepository, {
  async sendSms(payload) {
    return africaTalkingProvider.sendSms(payload);
  },
});
const ussdRepository = createUssdRepository();
const ussdService = new UssdService({
  repository: ussdRepository,
  smsProvider: {
    async sendSms(payload) {
      return africaTalkingProvider.sendSms(payload);
    },
  },
  airtimeService: new AirtimeService({
    repository: createAirtimeRewardRepository(),
    provider: {
      async sendAirtime(payload) {
        return africaTalkingProvider.sendAirtime(payload);
      },
    },
  }),
});
const voiceService = new VoiceService({
  repository: workOrderRepository,
  workOrderService,
  voiceProvider: {
    async initiateVoiceCall(payload) {
      return africaTalkingProvider.initiateVoiceCall(payload);
    },
  },
  smsProvider: {
    async sendSms(payload) {
      return africaTalkingProvider.sendSms(payload);
    },
  },
  callerNumber: config.africaTalking.voiceNumber,
  callbackUrl: config.africaTalking.voiceCallbackUrl,
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', ...configuredOrigins];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

function getBearerToken(req: Request): string | null {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const tokenValue = typeof req.body?.token === 'string' ? req.body.token : null;
  return tokenValue && tokenValue.trim() ? tokenValue.trim() : null;
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  let user: AppUser | null;

  try {
    user = await authService.getUserByToken(token);
  } catch (error) {
    next(error);
    return;
  }

  if (!user) {
    res.status(401).json({ ok: false, message: 'Authentication required.' });
    return;
  }

  req.user = user;
  next();
}

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  void next;

  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({
      ok: false,
      provider: 'africastalking',
      type: 'sms',
      message: 'Invalid JSON payload. Please send a valid JSON object.',
      endpoint: '/dev/at/sandbox/sms-test',
      endpointType: 'development-sandbox-test',
      note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
      environment: config.africaTalking.environment,
    });
    return;
  }

  res.status(500).json({
    ok: false,
    provider: 'africastalking',
    type: 'sms',
    message: 'An internal sandbox test error occurred. No credentials were exposed.',
    endpoint: '/dev/at/sandbox/sms-test',
    endpointType: 'development-sandbox-test',
    note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
    environment: config.africaTalking.environment,
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    application: config.appName,
    environment: config.environment,
    apiStatus: 'ok',
    africaTalking: africaTalkingProvider.getDiagnostics(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const session = await authService.login(email, password);

  if (!session) {
    res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    return;
  }

  res.status(200).json({
    ok: true,
    data: {
      token: session.token,
      user: session.user,
    },
  });
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  const loggedOut = await authService.logout(token);

  if (!loggedOut) {
    res.status(400).json({ ok: false, message: 'No active session to log out.' });
    return;
  }

  res.status(200).json({ ok: true, message: 'Logged out.' });
});

app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = req.user;
  res.status(200).json({ ok: true, data: user });
});

app.get('/api/users', requireAuth, async (req: Request, res: Response) => {
  const roleFilter = typeof req.query.role === 'string' ? req.query.role : undefined;
  const allowedRoleFilter = roleFilter && ['manager', 'operations', 'technician'].includes(roleFilter) ? roleFilter as AppUser['role'] : undefined;

  const user = req.user ?? null;
  if (!user) {
    res.status(401).json({ ok: false, message: 'Authentication required.' });
    return;
  }

  if (!['manager', 'operations'].includes(user.role)) {
    res.status(200).json({ ok: true, data: [] });
    return;
  }

  const users = await authService.getOrganizationUsers(user.organization_id, allowedRoleFilter, user);
  res.status(200).json({ ok: true, data: users });
});

app.get('/api/distributor/rewards', requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || !['manager', 'operations'].includes(user.role)) {
    res.status(403).json({ ok: false, message: 'Reward access denied.' });
    return;
  }

  const rewards = await new AirtimeService({
    repository: createAirtimeRewardRepository(),
    provider: { sendAirtime: async () => ({ ok: false, provider: 'africastalking', type: 'airtime', message: 'Not available.' }) },
  }).listRewardsForOrganization(user.organization_id);
  res.status(200).json({ ok: true, data: rewards.map(({ id, distributor_id, distributor_name, sales_report_id, phone_number, amount, currency, status, provider_reference, created_at, updated_at, sales_amount }) => ({ id, distributor_id, distributor_name, sales_report_id, phone_number, amount, currency, status, provider_reference, created_at, updated_at, sales_amount })) });
});

app.get('/api/dashboard/summary', requireAuth, async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const workOrders = await workOrderService.listWorkOrders();
  const currentUser = req.user ?? null;
  const scoped = filterWorkOrdersForUser(workOrders, currentUser, { status, priority });

  res.status(200).json({
    ok: true,
    data: {
      summary: getDashboardSummary(scoped),
      workOrders: scoped,
    },
  });
});

app.get('/api/dashboard/insights', requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || !['manager', 'operations'].includes(user.role)) {
    res.status(403).json({ ok: false, message: 'Operational insights access denied.' });
    return;
  }

  const insights = await getOperationalInsights(user, {
    listWorkOrders: () => workOrderRepository.listWorkOrders(),
    listWorkOrderEvents: (workOrderId) => workOrderRepository.listWorkOrderEvents(workOrderId),
    listInventoryItems: () => inventoryRepository.listInventoryItems(),
    listInventoryAlerts: () => inventoryRepository.listAlerts(),
    listSalesReportsForOrganization: (organizationId) => ussdRepository.listSalesReportsForOrganization(organizationId),
    listRewardsForOrganization: (organizationId) => createAirtimeRewardRepository().listRewardsForOrganization(organizationId),
  });
  res.status(200).json({ ok: true, data: insights });
});

app.post('/dev/at/sandbox/sms-test', async (req: Request, res: Response) => {
  const payload = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const recipient = typeof payload.recipient === 'string' ? payload.recipient : '';
  const message = typeof payload.message === 'string' ? payload.message : '';
  const senderId = typeof payload.senderId === 'string' ? payload.senderId : undefined;

  const response = await africaTalkingProvider.sendSms({ recipient, message, senderId });

  return res.status(response.ok ? 200 : 400).json({
    endpoint: '/dev/at/sandbox/sms-test',
    endpointType: 'development-sandbox-test',
    note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
    ...response,
    environment: config.africaTalking.environment,
  });
});

app.post(['/api/ussd/callback', '/api/africastalking/ussd', '/api/webhooks/africas-talking/ussd'], async (req: Request, res: Response) => {
  const payload = typeof req.body === 'object' && req.body !== null ? req.body as Record<string, unknown> : {};
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : typeof payload.session_id === 'string' ? payload.session_id : `ussd-${Date.now()}`;
  const serviceCode = typeof payload.serviceCode === 'string' ? payload.serviceCode : typeof payload.service_code === 'string' ? payload.service_code : '*123#';
  const phoneNumber = typeof payload.phoneNumber === 'string' ? payload.phoneNumber : typeof payload.phone_number === 'string' ? payload.phone_number : '';
  const text = typeof payload.text === 'string' ? payload.text : typeof payload.ussdString === 'string' ? payload.ussdString : '';

  const responseText = await ussdService.processCallback({
    sessionId,
    serviceCode,
    phoneNumber,
    text,
  });

  res.setHeader('Content-Type', 'text/plain');
  return res.status(200).send(responseText);
});

app.post('/api/work-orders/:id/voice-call', requireAuth, async (req: Request, res: Response) => {
  try {
    const actor = req.user;
    if (!actor) {
      res.status(401).json({ ok: false, message: 'Authentication required.' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await voiceService.initiateWorkOrderCall(id, actor);
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to initiate voice call.';
    res.status(400).json({ ok: false, message });
  }
});

app.post('/api/africastalking/voice', async (req: Request, res: Response) => {
  try {
    const payload = typeof req.body === 'object' && req.body !== null ? req.body as Record<string, unknown> : {};
    const queryWorkOrderId = typeof req.query.workOrderId === 'string' ? req.query.workOrderId : undefined;
    const response = await voiceService.handleCallback({
      workOrderId: queryWorkOrderId ?? (typeof payload.workOrderId === 'string' ? payload.workOrderId : typeof payload.work_order_id === 'string' ? payload.work_order_id : undefined),
      clientRequestId: typeof payload.clientRequestId === 'string' ? payload.clientRequestId : typeof payload.client_request_id === 'string' ? payload.client_request_id : undefined,
      callSessionId: typeof payload.sessionId === 'string' ? payload.sessionId : typeof payload.session_id === 'string' ? payload.session_id : typeof payload.callSessionId === 'string' ? payload.callSessionId : undefined,
      phoneNumber: typeof payload.callerNumber === 'string' ? payload.callerNumber : typeof payload.phoneNumber === 'string' ? payload.phoneNumber : undefined,
      digits: typeof payload.dtmfDigits === 'string' ? payload.dtmfDigits : typeof payload.digits === 'string' ? payload.digits : undefined,
    });
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(response);
  } catch {
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unable to process this voice request.</Say></Response>');
  }
});

app.get('/api/inventory', async (_req: Request, res: Response) => {
  const items = await inventoryService.listInventoryItems();
  res.status(200).json({ ok: true, data: items });
});

app.post('/api/inventory/alerts/trigger', async (_req: Request, res: Response) => {
  const summary = await inventoryService.triggerLowStockAlerts();
  res.status(200).json({ ok: true, data: summary });
});

app.get('/api/inventory/alerts', async (_req: Request, res: Response) => {
  const alerts = await inventoryService.listAlerts();
  res.status(200).json({ ok: true, data: alerts });
});

app.get('/api/inventory/:id', async (req: Request, res: Response) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const item = await inventoryService.getInventoryItemById(itemId);

  if (!item) {
    res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    return;
  }

  res.status(200).json({ ok: true, data: item });
});

app.post('/api/inventory', async (req: Request, res: Response) => {
  try {
    const item = await inventoryService.createInventoryItem(req.body ?? {});
    res.status(201).json({ ok: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create inventory item.';
    res.status(400).json({ ok: false, message });
  }
});

app.patch('/api/inventory/:id/quantity', async (req: Request, res: Response) => {
  try {
    const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const quantity = Number(req.body?.quantity ?? req.body?.quantity_available ?? 0);
    const item = await inventoryService.updateInventoryQuantity(itemId, quantity);
    res.status(200).json({ ok: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update quantity.';
    res.status(400).json({ ok: false, message });
  }
});

app.get('/api/contacts', async (_req: Request, res: Response) => {
  const contacts = await inventoryService.listContacts();
  res.status(200).json({ ok: true, data: contacts });
});

app.post('/api/contacts', async (req: Request, res: Response) => {
  try {
    const contact = await inventoryService.createContact(req.body ?? {});
    res.status(201).json({ ok: true, data: contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create contact.';
    res.status(400).json({ ok: false, message });
  }
});

app.get('/api/work-orders', requireAuth, async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const workOrders = await workOrderService.listWorkOrders();
  const currentUser = req.user ?? null;
  const visible = filterWorkOrdersForUser(workOrders, currentUser, { status, priority });

  res.status(200).json({ ok: true, data: visible });
});

app.get('/api/work-orders/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const workOrder = await workOrderService.getWorkOrderById(id);

  if (!workOrder) {
    res.status(404).json({ ok: false, message: 'Work order not found.' });
    return;
  }

  const currentUser = req.user ?? null;
  if (!canUserAccessWorkOrder(currentUser, workOrder)) {
    res.status(403).json({ ok: false, message: 'Work order not available in your organization or role.' });
    return;
  }

  res.status(200).json({ ok: true, data: workOrder });
});

app.post('/api/work-orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const workOrder = await workOrderService.createWorkOrder(req.body ?? {});
    res.status(201).json({ ok: true, data: workOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create work order.';
    res.status(400).json({ ok: false, message });
  }
});

app.patch('/api/work-orders/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const workOrder = await workOrderService.updateWorkOrder(id, req.body ?? {});
    res.status(200).json({ ok: true, data: workOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update work order.';
    res.status(400).json({ ok: false, message });
  }
});

app.post('/api/work-orders/:id/assign', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const assigneeId = typeof req.body?.assignee_id === 'string' ? req.body.assignee_id : '';
    const phoneNumber = typeof req.body?.assignee_phone_number === 'string' ? req.body.assignee_phone_number : null;
    const workOrder = await workOrderService.assignWorkOrder(id, assigneeId, phoneNumber);
    res.status(200).json({ ok: true, data: workOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to assign work order.';
    res.status(400).json({ ok: false, message });
  }
});

app.post('/api/work-orders/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const newStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    const workOrder = await workOrderService.updateWorkOrderStatus(id, newStatus);
    res.status(200).json({ ok: true, data: workOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update work order status.';
    res.status(400).json({ ok: false, message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`FactoryLink API listening on port ${port}`);
  console.log('Africa\'s Talking sandbox readiness:', africaTalkingProvider.getDiagnostics());
});
