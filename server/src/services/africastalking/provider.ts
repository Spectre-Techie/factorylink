import AfricaTalkingFactory from 'africastalking';

export type ProviderType = 'sms' | 'ussd' | 'voice' | 'airtime';
export type AfricaTalkingEnvironment = 'sandbox' | 'production';

export interface ProviderRequest {
  type: ProviderType;
  to: string;
  payload: Record<string, unknown>;
}

export interface ProviderResponse {
  ok: boolean;
  provider: 'africastalking';
  type: ProviderType;
  message: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

export interface SandboxSmsPayload {
  recipient: string;
  message: string;
  senderId?: string;
}

export interface AfricaTalkingClientConfig {
  environment: AfricaTalkingEnvironment;
  username: string;
  apiKey: string;
  baseUrl?: string;
  senderId?: string;
}

export interface AfricaTalkingDiagnostics {
  provider: 'africastalking';
  environment: AfricaTalkingEnvironment;
  sandboxMode: boolean;
  ready: boolean;
  username: string;
  apiKeyFingerprint: string;
  baseUrl?: string;
  senderId?: string;
}

export interface AfricaTalkingProvider {
  sendSms(payload: Record<string, unknown>): Promise<ProviderResponse>;
  startUssdSession(payload: Record<string, unknown>): Promise<ProviderResponse>;
  initiateVoiceCall(payload: Record<string, unknown>): Promise<ProviderResponse>;
  sendAirtime(payload: Record<string, unknown>): Promise<ProviderResponse>;
  getDiagnostics(): AfricaTalkingDiagnostics;
}

function maskSecret(secret: string): string {
  const trimmed = secret.trim();

  if (trimmed.length <= 8) {
    return `${'*'.repeat(Math.max(trimmed.length, 4))}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`;
}

function normalizeUsername(environment: AfricaTalkingEnvironment, username: string): string {
  const cleaned = username.trim();

  if (environment === 'sandbox') {
    return 'sandbox';
  }

  return cleaned || 'sandbox';
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/(Authorization|authorization|apikey|api[_-]?key)\s*[:=]\s*['"]?[^\s"',;]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9._-]{20,}\b/g, '[REDACTED]');
}

function sanitizeForDebug(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDebug(item));
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      if (['authorization', 'apikey', 'api-key', 'api_key', 'x-api-key', 'token', 'cookie'].includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = sanitizeForDebug(nestedValue);
    }

    return sanitized;
  }

  return value;
}

function sanitizeError(error: unknown): {
  code?: string;
  message: string;
  status?: number;
  statusText?: string;
  providerErrorBody?: unknown;
} {
  const maybeError = error as Record<string, unknown> | undefined;
  const status = typeof maybeError?.response === 'object' && maybeError.response !== null
    ? (maybeError.response as Record<string, unknown>).status as number | undefined
    : undefined;
  const statusText = typeof maybeError?.response === 'object' && maybeError.response !== null
    ? (maybeError.response as Record<string, unknown>).statusText as string | undefined
    : undefined;
  const responseBody = typeof maybeError?.response === 'object' && maybeError.response !== null
    ? (maybeError.response as Record<string, unknown>).data
    : undefined;

  const message = typeof maybeError?.message === 'string'
    ? redactSensitiveText(maybeError.message)
    : 'An unknown provider error occurred. No credentials were exposed.';

  return {
    code: (typeof maybeError?.code === 'string' ? maybeError.code : maybeError?.name as string | undefined) ?? 'unknown_error',
    message,
    status,
    statusText: statusText ? redactSensitiveText(statusText) : undefined,
    providerErrorBody: sanitizeForDebug(responseBody),
  };
}

function validateSandboxSmsRequest(payload: SandboxSmsPayload): { valid: boolean; message: string } {
  const recipient = payload.recipient.trim();
  const message = payload.message.trim();

  if (!recipient) {
    return { valid: false, message: 'Recipient phone number is required.' };
  }

  const normalizedRecipient = recipient.replace(/[\s()-]/g, '');

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedRecipient)) {
    return {
      valid: false,
      message: 'Recipient must be a valid international E.164 phone number, for example +254712345678.',
    };
  }

  if (!message) {
    return { valid: false, message: 'Message is required.' };
  }

  if (message.length > 160) {
    return { valid: false, message: 'Sandbox test message must be 160 characters or less.' };
  }

  return { valid: true, message: 'Sandbox SMS payload validated.' };
}

function buildSdkClient({ username, apiKey }: Pick<AfricaTalkingClientConfig, 'username' | 'apiKey'>) {
  const AfricaTalking = AfricaTalkingFactory as (options: {
    username: string;
    apiKey: string;
    format?: 'json' | 'xml';
  }) => {
    SMS: {
      send: (options: {
        to: string | string[];
        message: string;
        senderId?: string;
      }) => Promise<unknown>;
    };
    USSD: unknown;
    VOICE: unknown;
    AIRTIME: unknown;
    TOKEN: unknown;
    APPLICATION: unknown;
    INSIGHTS: unknown;
    WHATSAPP: unknown;
    MOBILE_DATA: unknown;
  };

  return AfricaTalking({
    username,
    apiKey,
    format: 'json',
  });
}

export function createAfricaTalkingProvider(config: AfricaTalkingClientConfig): AfricaTalkingProviderImpl {
  return new AfricaTalkingProviderImpl(config);
}

export function getAfricaTalkingDiagnostics(config: AfricaTalkingClientConfig): AfricaTalkingDiagnostics {
  const username = normalizeUsername(config.environment, config.username);
  const sandboxMode = config.environment === 'sandbox' || username === 'sandbox';

  return {
    provider: 'africastalking',
    environment: config.environment,
    sandboxMode,
    ready: Boolean(config.apiKey && config.apiKey.trim()),
    username: username === 'sandbox' ? 'sandbox' : username.slice(0, 2) + '***',
    apiKeyFingerprint: maskSecret(config.apiKey),
    baseUrl: config.baseUrl,
    senderId: config.senderId,
  };
}

export class AfricaTalkingProviderImpl implements AfricaTalkingProvider {
  private readonly client: ReturnType<typeof buildSdkClient> | null;

  constructor(private readonly config: AfricaTalkingClientConfig) {
    const username = normalizeUsername(config.environment, config.username);
    this.client = username && config.apiKey ? buildSdkClient({ username, apiKey: config.apiKey }) : null;
  }

  getDiagnostics(): AfricaTalkingDiagnostics {
    return getAfricaTalkingDiagnostics(this.config);
  }

  async sendSms(payload: Record<string, unknown>): Promise<ProviderResponse> {
    const recipient = typeof payload.recipient === 'string' ? payload.recipient : typeof payload.to === 'string' ? payload.to : '';
    const message = typeof payload.message === 'string' ? payload.message : '';
    const senderId = typeof payload.senderId === 'string' ? payload.senderId : this.config.senderId;
    const validation = validateSandboxSmsRequest({ recipient, message, senderId });

    if (!validation.valid) {
      return {
        ok: false,
        provider: 'africastalking',
        type: 'sms',
        message: validation.message,
        requestId: this.makeRequestId(),
        meta: {
          endpointType: 'development-sandbox-test',
          environment: this.config.environment,
          sandboxMode: this.config.environment === 'sandbox',
        },
      };
    }

    const isSandboxEnvironment = this.config.environment === 'sandbox' && normalizeUsername(this.config.environment, this.config.username) === 'sandbox';

    if (!isSandboxEnvironment) {
      return {
        ok: false,
        provider: 'africastalking',
        type: 'sms',
        message: 'Sandbox SMS testing is restricted to the Africa\'s Talking sandbox environment only.',
        requestId: this.makeRequestId(),
        meta: {
          endpointType: 'development-sandbox-test',
          environment: this.config.environment,
          sandboxMode: false,
        },
      };
    }

    const smsClient = this.client?.SMS;

    if (!smsClient || typeof smsClient.send !== 'function') {
      return {
        ok: false,
        provider: 'africastalking',
        type: 'sms',
        message: 'Africa\'s Talking SMS client is not available in the current sandbox configuration.',
        requestId: this.makeRequestId(),
        meta: {
          endpointType: 'development-sandbox-test',
          environment: this.config.environment,
          sandboxMode: true,
        },
      };
    }

    try {
      await smsClient.send({
        to: recipient,
        message,
        senderId,
      });

      return {
        ok: true,
        provider: 'africastalking',
        type: 'sms',
        message: 'Sandbox SMS test sent successfully.',
        requestId: this.makeRequestId(),
        meta: {
          endpointType: 'development-sandbox-test',
          environment: this.config.environment,
          sandboxMode: true,
        },
      };
    } catch (error) {
      const sanitized = sanitizeError(error);

      return {
        ok: false,
        provider: 'africastalking',
        type: 'sms',
        message: 'Sandbox SMS test failed. Provider error details were sanitized for security.',
        requestId: this.makeRequestId(),
        meta: {
          endpointType: 'development-sandbox-test',
          environment: this.config.environment,
          sandboxMode: true,
          providerStatus: sanitized.status,
          providerStatusText: sanitized.statusText,
          providerErrorCode: sanitized.code,
          providerErrorMessage: sanitized.message,
          providerErrorBody: sanitized.providerErrorBody,
        },
      };
    }
  }

  async startUssdSession(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return this.createResponse('ussd', 'USSD provider abstraction initialized.', payload);
  }

  async initiateVoiceCall(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return this.createResponse('voice', 'Voice provider abstraction initialized.', payload);
  }

  async sendAirtime(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return this.createResponse('airtime', 'Airtime provider abstraction initialized.', payload);
  }

  private createResponse(type: ProviderType, message: string, payload: Record<string, unknown>): ProviderResponse {
    const diagnostics = this.getDiagnostics();

    return {
      ok: true,
      provider: 'africastalking',
      type,
      message,
      requestId: this.makeRequestId(),
      meta: {
        clientInitialized: this.client !== null,
        environment: diagnostics.environment,
        sandboxMode: diagnostics.sandboxMode,
      },
      ...(payload as Record<string, unknown>),
    };
  }

  private makeRequestId(): string {
    return `at-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}
