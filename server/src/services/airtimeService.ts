import type { AirtimeReward, AirtimeRewardRepository } from './airtimeRepository.js';

export interface AirtimeProvider {
  sendAirtime(payload: Record<string, unknown>): Promise<{
    ok: boolean;
    provider: string;
    type: string;
    message: string;
    requestId?: string;
    meta?: Record<string, unknown>;
  }>;
}

export type RewardResult = {
  eligible: boolean;
  reward: AirtimeReward | null;
};

function sanitizeFailureReason(message: string): string {
  return message
    .replace(/(api[\s_-]?key|authorization|token|password|secret)\s*[:=]?\s*[^\s,.;]+/gi, '$1 [redacted]')
    .replace(/\b[A-Za-z0-9._-]{20,}\b/g, '[redacted]');
}

export class AirtimeService {
  constructor(
    private readonly config: {
      repository: AirtimeRewardRepository;
      provider: AirtimeProvider;
    },
  ) {}

  calculateReward(amount: number): number | null {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100000) return null;
    if (value < 200000) return 100;
    if (value < 400000) return 250;
    return 500;
  }

  async processSalesReportReward(salesReportId: string): Promise<RewardResult> {
    const existing = await this.config.repository.getRewardBySalesReportId(salesReportId);
    if (existing) return { eligible: true, reward: existing };

    const report = await this.config.repository.getSalesReportById(salesReportId);
    if (!report || report.status !== 'submitted') return { eligible: false, reward: null };

    const rewardAmount = this.calculateReward(report.amount);
    if (rewardAmount === null) return { eligible: false, reward: null };

    const distributor = await this.config.repository.getDistributorById(report.distributor_id);
    if (!distributor || distributor.status !== 'active' || distributor.organization_id !== report.organization_id) {
      throw new Error('Unable to validate sales report distributor.');
    }

    const reward = await this.config.repository.createReward({
      organization_id: report.organization_id,
      distributor_id: distributor.id,
      sales_report_id: report.id,
      phone_number: distributor.phone_number,
      amount: rewardAmount,
      currency: 'NGN',
      status: 'pending',
      provider_reference: null,
      failure_reason: null,
    });

    const response = await this.config.provider.sendAirtime({
      phoneNumber: reward.phone_number,
      amount: reward.amount,
      currencyCode: reward.currency,
      idempotencyKey: `factorylink-airtime-${reward.sales_report_id}`,
      salesReportId: reward.sales_report_id,
    });

    if (!response.ok) {
      const failed = await this.config.repository.updateRewardStatus(reward.id, {
        status: 'failed',
        failure_reason: sanitizeFailureReason(response.message),
        provider_reference: null,
      });
      return { eligible: true, reward: failed };
    }

    const providerReference = typeof response.meta?.providerReference === 'string' ? response.meta.providerReference : response.requestId ?? null;
    const sent = await this.config.repository.updateRewardStatus(reward.id, {
      status: 'sent',
      provider_reference: providerReference,
      failure_reason: null,
    });
    return { eligible: true, reward: sent };
  }

  async listRewardsForOrganization(organizationId: string): Promise<AirtimeReward[]> {
    return this.config.repository.listRewardsForOrganization(organizationId);
  }
}