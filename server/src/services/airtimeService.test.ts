import test from 'node:test';
import assert from 'node:assert/strict';

import type { AirtimeReward, AirtimeRewardRepository } from './airtimeRepository.js';
import type { DistributorRecord, SalesReportRecord } from './ussdRepository.js';
import { AirtimeService } from './airtimeService.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const distributorId = '22222222-2222-4222-8222-222222222222';
const reportId = '33333333-3333-4333-8333-333333333333';

const distributor: DistributorRecord = {
  id: distributorId,
  organization_id: organizationId,
  name: 'Phase 6 Distributor',
  phone_number: '+254700000001',
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makeReport(amount: number, overrides: Partial<SalesReportRecord> = {}): SalesReportRecord {
  return {
    id: reportId,
    organization_id: organizationId,
    distributor_id: distributorId,
    amount,
    status: 'submitted',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeContext(options: { amount?: number; report?: SalesReportRecord | null; providerOk?: boolean; distributor?: DistributorRecord | null } = {}) {
  const rewards: AirtimeReward[] = [];
  const reports = options.report === null ? [] : [options.report ?? makeReport(options.amount ?? 400000)];
  const events: string[] = [];
  const repository: AirtimeRewardRepository = {
    getRewardBySalesReportId: async (id) => rewards.find((reward) => reward.sales_report_id === id) ?? null,
    getSalesReportById: async (id) => reports.find((report) => report.id === id) ?? null,
    getDistributorById: async () => options.distributor === undefined ? distributor : options.distributor,
    createReward: async (input) => {
      const now = new Date().toISOString();
      const reward = { ...input, id: `reward-${rewards.length + 1}`, created_at: now, updated_at: now };
      rewards.push(reward);
      events.push('created');
      return reward;
    },
    updateRewardStatus: async (id, input) => {
      const reward = rewards.find((entry) => entry.id === id);
      if (!reward) throw new Error('missing reward');
      Object.assign(reward, input, { updated_at: new Date().toISOString() });
      events.push(input.status);
      return reward;
    },
    listRewardsForOrganization: async (id) => rewards.filter((reward) => reward.organization_id === id),
  };
  const providerRequests: Record<string, unknown>[] = [];
  const service = new AirtimeService({
    repository,
    provider: {
      sendAirtime: async (payload) => {
        providerRequests.push(payload);
        return options.providerOk === false
          ? { ok: false, provider: 'test', type: 'airtime', message: 'Provider unavailable. API key hidden.' }
          : { ok: true, provider: 'test', type: 'airtime', message: 'sent', meta: { providerReference: 'AT-REF-1' } };
      },
    },
  });
  return { service, rewards, events, providerRequests };
}

test('reward calculation returns no reward below threshold', () => {
  assert.equal(new AirtimeService({} as never).calculateReward(99999), null);
});

test('reward tiers are deterministic at every boundary', () => {
  const service = new AirtimeService({} as never);
  assert.equal(service.calculateReward(100000), 100);
  assert.equal(service.calculateReward(199999), 100);
  assert.equal(service.calculateReward(200000), 250);
  assert.equal(service.calculateReward(399999), 250);
  assert.equal(service.calculateReward(400000), 500);
  assert.equal(service.calculateReward(500000), 500);
});

test('eligible reward uses the trusted distributor and phone', async () => {
  const context = makeContext({ amount: 100000 });
  const result = await context.service.processSalesReportReward(reportId);
  assert.equal(result.reward?.amount, 100);
  assert.equal(result.reward?.distributor_id, distributorId);
  assert.equal(result.reward?.phone_number, distributor.phone_number);
  assert.equal(context.providerRequests[0].phoneNumber, distributor.phone_number);
});

test('reward is initially persisted as pending before provider completion', async () => {
  const context = makeContext({ amount: 200000 });
  const original = context.service['config'].provider.sendAirtime;
  context.service['config'].provider.sendAirtime = async () => {
    assert.equal(context.rewards[0].status, 'pending');
    return original({});
  };
  const result = await context.service.processSalesReportReward(reportId);
  assert.equal(result.reward?.status, 'sent');
});

test('provider success persists sent status and reference', async () => {
  const context = makeContext({ amount: 400000 });
  const result = await context.service.processSalesReportReward(reportId);
  assert.equal(result.reward?.status, 'sent');
  assert.equal(result.reward?.provider_reference, 'AT-REF-1');
});

test('provider failure persists failed status and keeps the report available', async () => {
  const context = makeContext({ amount: 400000, providerOk: false });
  const result = await context.service.processSalesReportReward(reportId);
  assert.equal(result.reward?.status, 'failed');
  assert.match(result.reward?.failure_reason ?? '', /Provider unavailable/);
  assert.equal(context.rewards.length, 1);
});

test('provider failure reason is sanitized at the provider boundary', async () => {
  const context = makeContext({ amount: 400000, providerOk: false });
  const result = await context.service.processSalesReportReward(reportId);
  assert.doesNotMatch(result.reward?.failure_reason ?? '', /API key hidden/);
});

test('duplicate processing returns the existing reward without a second provider request', async () => {
  const context = makeContext({ amount: 400000 });
  const first = await context.service.processSalesReportReward(reportId);
  const second = await context.service.processSalesReportReward(reportId);
  assert.equal(first.reward?.id, second.reward?.id);
  assert.equal(context.rewards.length, 1);
  assert.equal(context.providerRequests.length, 1);
});

test('organization mismatch rejects reward creation', async () => {
  const context = makeContext({ amount: 400000, report: makeReport(400000, { organization_id: otherOrganizationId }) });
  await assert.rejects(() => context.service.processSalesReportReward(reportId), /validate sales report distributor/i);
  assert.equal(context.rewards.length, 0);
});

test('inactive or missing distributor rejects reward creation', async () => {
  const context = makeContext({ amount: 400000, distributor: { ...distributor, status: 'inactive' } });
  await assert.rejects(() => context.service.processSalesReportReward(reportId), /validate sales report distributor/i);
});

test('missing or rejected sales report is not eligible', async () => {
  const missing = makeContext({ report: null });
  assert.deepEqual(await missing.service.processSalesReportReward(reportId), { eligible: false, reward: null });
  const rejected = makeContext({ report: makeReport(400000, { status: 'rejected' }) });
  assert.deepEqual(await rejected.service.processSalesReportReward(reportId), { eligible: false, reward: null });
});

test('organization reward listing is scoped by organization', async () => {
  const context = makeContext({ amount: 400000 });
  await context.service.processSalesReportReward(reportId);
  assert.equal((await context.service.listRewardsForOrganization(organizationId)).length, 1);
  assert.equal((await context.service.listRewardsForOrganization(otherOrganizationId)).length, 0);
});

test('reward amount cannot be supplied by provider request input', async () => {
  const context = makeContext({ amount: 200000 });
  await context.service.processSalesReportReward(reportId);
  assert.equal(context.rewards[0].amount, 250);
  assert.equal(context.providerRequests[0].amount, 250);
});
