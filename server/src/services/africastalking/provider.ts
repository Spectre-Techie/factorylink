export type ProviderType = 'sms' | 'ussd' | 'voice' | 'airtime';

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
}

export interface AfricaTalkingProvider {
  sendSms(payload: Record<string, unknown>): Promise<ProviderResponse>;
  startUssdSession(payload: Record<string, unknown>): Promise<ProviderResponse>;
  initiateVoiceCall(payload: Record<string, unknown>): Promise<ProviderResponse>;
  sendAirtime(payload: Record<string, unknown>): Promise<ProviderResponse>;
}

export class AfricaTalkingProviderImpl implements AfricaTalkingProvider {
  async sendSms(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return {
      ok: true,
      provider: 'africastalking',
      type: 'sms',
      message: 'SMS provider abstraction initialized.',
      requestId: this.makeRequestId(),
      ...(payload as Record<string, unknown>),
    };
  }

  async startUssdSession(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return {
      ok: true,
      provider: 'africastalking',
      type: 'ussd',
      message: 'USSD provider abstraction initialized.',
      requestId: this.makeRequestId(),
      ...(payload as Record<string, unknown>),
    };
  }

  async initiateVoiceCall(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return {
      ok: true,
      provider: 'africastalking',
      type: 'voice',
      message: 'Voice provider abstraction initialized.',
      requestId: this.makeRequestId(),
      ...(payload as Record<string, unknown>),
    };
  }

  async sendAirtime(payload: Record<string, unknown>): Promise<ProviderResponse> {
    return {
      ok: true,
      provider: 'africastalking',
      type: 'airtime',
      message: 'Airtime provider abstraction initialized.',
      requestId: this.makeRequestId(),
      ...(payload as Record<string, unknown>),
    };
  }

  private makeRequestId(): string {
    return `at-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}
