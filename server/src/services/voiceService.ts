import type { AppUser } from './authService.js';
import type { WorkOrderRepository } from './workOrderRepository.js';
import type { WorkOrderService } from './workOrderService.js';

interface VoiceProvider {
  initiateVoiceCall(payload: Record<string, unknown>): Promise<{
    ok: boolean;
    provider: string;
    type: string;
    message: string;
    requestId?: string;
    meta?: Record<string, unknown>;
  }>;
}

interface SmsProvider {
  sendSms(payload: Record<string, unknown>): Promise<{ ok: boolean; provider: string; type: string; message: string; requestId?: string }>;
}

export interface VoiceCallback {
  workOrderId?: string;
  clientRequestId?: string;
  callSessionId?: string;
  phoneNumber?: string;
  digits?: string;
}

const VALID_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class VoiceService {
  constructor(
    private readonly config: {
      repository: WorkOrderRepository;
      workOrderService: WorkOrderService;
      voiceProvider: VoiceProvider;
      smsProvider: SmsProvider;
      callerNumber: string;
      callbackUrl: string;
    },
  ) {}

  async initiateWorkOrderCall(workOrderId: string, actor: AppUser): Promise<{ message: string; requestId?: string }> {
    if (!['manager', 'operations'].includes(actor.role)) {
      throw new Error('Only manager or operations users can initiate technician calls.');
    }

    const workOrder = await this.config.repository.getWorkOrderById(workOrderId);
    if (!workOrder || workOrder.organization_id !== actor.organization_id) {
      throw new Error('Work order not found.');
    }

    if (workOrder.status !== 'assigned' || workOrder.assigned_to_user_id === null) {
      throw new Error('Only assigned work orders can be called.');
    }

    const phoneNumber = workOrder.assignee_phone_number?.trim() ?? '';
    if (!VALID_PHONE_NUMBER.test(phoneNumber)) {
      throw new Error('Assigned technician must have a valid phone number.');
    }

    const clientRequestId = `work-order-${workOrder.id}-${Date.now()}`;
    const response = await this.config.voiceProvider.initiateVoiceCall({
      callFrom: this.config.callerNumber,
      callTo: phoneNumber,
      clientRequestId,
    });

    await this.config.repository.createWorkOrderEvent({
      organization_id: workOrder.organization_id,
      work_order_id: workOrder.id,
      actor_user_id: actor.id,
      event_type: response.ok ? 'work_order_voice_call_started' : 'work_order_voice_call_failed',
      details: {
        assignee_phone_number: phoneNumber,
        client_request_id: clientRequestId,
        provider: response.provider,
        type: response.type,
        message: response.message,
        request_id: response.requestId ?? null,
      },
    });

    if (!response.ok) {
      throw new Error(response.message);
    }

    return { message: response.message, requestId: response.requestId };
  }

  async handleCallback(callback: VoiceCallback): Promise<string> {
    const workOrderId = callback.workOrderId?.trim() || this.extractWorkOrderId(callback.clientRequestId);
    const callSessionId = callback.callSessionId?.trim();

    if (!workOrderId || !callSessionId) {
      return this.sayAndHangup('This voice session is invalid. Please contact your operations team.');
    }

    const workOrder = await this.config.repository.getWorkOrderById(workOrderId);
    if (!workOrder) {
      return this.sayAndHangup('This maintenance task could not be found.');
    }

    const phoneNumber = callback.phoneNumber?.trim();
    if (phoneNumber && phoneNumber !== workOrder.assignee_phone_number) {
      return this.sayAndHangup('This call is not authorized for the assigned technician.');
    }

    const priorEvents = await this.config.repository.listWorkOrderEvents(workOrder.id);
    const priorAction = priorEvents.find((event) => (
      ['work_order_voice_task_accepted', 'work_order_voice_task_declined'].includes(event.event_type)
      && event.details.call_session_id === callSessionId
    ));

    if (priorAction) {
      return priorAction.event_type === 'work_order_voice_task_accepted'
        ? this.acceptResponse()
        : this.declineResponse();
    }

    const digits = callback.digits?.trim() ?? '';
    if (!digits) {
      return this.promptResponse(workOrder.id);
    }

    if (digits !== '1' && digits !== '2') {
      return this.promptResponse(workOrder.id, 'Invalid choice. Press 1 to accept or 2 to decline.');
    }

    if (digits === '1') {
      if (workOrder.status === 'assigned') {
        await this.config.workOrderService.updateWorkOrderStatus(workOrder.id, 'in_progress');
      } else if (workOrder.status !== 'in_progress') {
        return this.sayAndHangup('This task is no longer available for acceptance.');
      }

      await this.recordAction(workOrder.id, workOrder.organization_id, callSessionId, 'work_order_voice_task_accepted', callback);
      await this.sendConfirmation(workOrder.assignee_phone_number, `FactoryLink: maintenance task "${workOrder.title}" accepted.`);
      return this.acceptResponse();
    }

    if (workOrder.status !== 'assigned' && workOrder.status !== 'in_progress') {
      return this.sayAndHangup('This task is no longer available for decline.');
    }

    await this.recordAction(workOrder.id, workOrder.organization_id, callSessionId, 'work_order_voice_task_declined', callback);
    await this.sendConfirmation(workOrder.assignee_phone_number, `FactoryLink: maintenance task "${workOrder.title}" declined. Operations has been notified.`);
    return this.declineResponse();
  }

  private async recordAction(workOrderId: string, organizationId: string, callSessionId: string, eventType: string, callback: VoiceCallback): Promise<void> {
    await this.config.repository.createWorkOrderEvent({
      organization_id: organizationId,
      work_order_id: workOrderId,
      actor_user_id: null,
      event_type: eventType,
      details: {
        call_session_id: callSessionId,
        phone_number: callback.phoneNumber ?? null,
        digits: callback.digits ?? null,
      },
    });
  }

  private async sendConfirmation(phoneNumber: string | null, message: string): Promise<void> {
    if (phoneNumber) {
      await this.config.smsProvider.sendSms({ recipient: phoneNumber, message, senderId: 'FactoryLink' });
    }
  }

  private extractWorkOrderId(clientRequestId?: string): string | undefined {
    const prefix = 'work-order-';
    if (!clientRequestId?.startsWith(prefix)) return undefined;
    const value = clientRequestId.slice(prefix.length);
    const separator = value.lastIndexOf('-');
    return separator > 0 ? value.slice(0, separator) : value;
  }

  private promptResponse(workOrderId: string, message?: string): string {
    const prompt = message ?? 'FactoryLink maintenance notification. A maintenance task has been assigned to you. Press 1 to accept. Press 2 to decline.';
    const callbackUrl = `${this.config.callbackUrl}?workOrderId=${encodeURIComponent(workOrderId)}`;
    return `<?xml version="1.0" encoding="UTF-8"?><Response><GetDigits numDigits="1" timeout="10" callbackUrl="${escapeXml(callbackUrl)}"><Say>${escapeXml(prompt)}</Say></GetDigits></Response>`;
  }

  private acceptResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml('Thank you. The task has been accepted. You may now begin the assigned maintenance work.')}</Say></Response>`;
  }

  private declineResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml('The task has been declined. Your operations team has been notified.')}</Say></Response>`;
  }

  private sayAndHangup(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say></Response>`;
  }
}
