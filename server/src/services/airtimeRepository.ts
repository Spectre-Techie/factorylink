import { createClient } from '@supabase/supabase-js';

import type { DistributorRecord, SalesReportRecord } from './ussdRepository.js';

export type AirtimeRewardStatus = 'pending' | 'sent' | 'failed';

export interface AirtimeReward {
  id: string;
  organization_id: string;
  distributor_id: string;
  sales_report_id: string;
  phone_number: string;
  amount: number;
  currency: string;
  status: AirtimeRewardStatus;
  provider_reference: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  sales_amount?: number;
}

export interface AirtimeRewardRepository {
  getRewardBySalesReportId(salesReportId: string): Promise<AirtimeReward | null>;
  getSalesReportById(salesReportId: string): Promise<SalesReportRecord | null>;
  getDistributorById(distributorId: string): Promise<DistributorRecord | null>;
  createReward(input: Omit<AirtimeReward, 'id' | 'created_at' | 'updated_at'>): Promise<AirtimeReward>;
  updateRewardStatus(id: string, input: { status: AirtimeRewardStatus; provider_reference?: string | null; failure_reason?: string | null }): Promise<AirtimeReward>;
  listRewardsForOrganization(organizationId: string): Promise<AirtimeReward[]>;
}

class InMemoryAirtimeRewardRepository implements AirtimeRewardRepository {
  private readonly rewards: AirtimeReward[] = [];

  private readonly salesReports: SalesReportRecord[] = [];

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

  async getRewardBySalesReportId(salesReportId: string): Promise<AirtimeReward | null> {
    return this.rewards.find((reward) => reward.sales_report_id === salesReportId) ?? null;
  }

  async getSalesReportById(salesReportId: string): Promise<SalesReportRecord | null> {
    return this.salesReports.find((report) => report.id === salesReportId) ?? null;
  }

  async getDistributorById(distributorId: string): Promise<DistributorRecord | null> {
    return this.distributors.find((distributor) => distributor.id === distributorId) ?? null;
  }

  async createReward(input: Omit<AirtimeReward, 'id' | 'created_at' | 'updated_at'>): Promise<AirtimeReward> {
    const now = new Date().toISOString();
    const reward: AirtimeReward = { ...input, id: `reward-${Date.now()}`, created_at: now, updated_at: now };
    this.rewards.unshift(reward);
    return reward;
  }

  async updateRewardStatus(id: string, input: { status: AirtimeRewardStatus; provider_reference?: string | null; failure_reason?: string | null }): Promise<AirtimeReward> {
    const reward = this.rewards.find((entry) => entry.id === id);
    if (!reward) throw new Error('Unable to update airtime reward.');
    Object.assign(reward, input, { updated_at: new Date().toISOString() });
    return reward;
  }

  async listRewardsForOrganization(organizationId: string): Promise<AirtimeReward[]> {
    return this.rewards.filter((reward) => reward.organization_id === organizationId);
  }
}

export function createAirtimeRewardRepository(): AirtimeRewardRepository {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (url && serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    return {
      async getRewardBySalesReportId(salesReportId) {
        const { data, error } = await supabase.from('airtime_rewards').select('*').eq('sales_report_id', salesReportId).maybeSingle();
        if (error) throw new Error('Unable to load airtime reward.');
        return (data as AirtimeReward | null) ?? null;
      },
      async getSalesReportById(salesReportId) {
        const { data, error } = await supabase.from('sales_reports').select('*').eq('id', salesReportId).maybeSingle();
        if (error) throw new Error('Unable to load sales report.');
        return (data as SalesReportRecord | null) ?? null;
      },
      async getDistributorById(distributorId) {
        const { data, error } = await supabase.from('distributor_profiles').select('*').eq('id', distributorId).maybeSingle();
        if (error) throw new Error('Unable to resolve distributor.');
        return (data as DistributorRecord | null) ?? null;
      },
      async createReward(input) {
        const { data, error } = await supabase.from('airtime_rewards').insert(input).select().single();
        if (error) throw new Error('Unable to create airtime reward.');
        return data as AirtimeReward;
      },
      async updateRewardStatus(id, input) {
        const { data, error } = await supabase.from('airtime_rewards').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw new Error('Unable to update airtime reward.');
        return data as AirtimeReward;
      },
      async listRewardsForOrganization(organizationId) {
        const { data, error } = await supabase.from('airtime_rewards').select('*, sales_reports(amount)').eq('organization_id', organizationId).order('created_at', { ascending: false });
        if (error) throw new Error('Unable to list airtime rewards.');
        return ((data ?? []) as Array<AirtimeReward & { sales_reports?: { amount?: number } | null }>).map(({ sales_reports, ...reward }) => ({
          ...reward,
          sales_amount: sales_reports?.amount,
        }));
      },
    };
  }

  return new InMemoryAirtimeRewardRepository();
}