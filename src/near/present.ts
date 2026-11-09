import { sampleWallet } from '../data';
import type { AccountRead } from './chain';
import { formatNear } from './format';

export type PoolView = {
  id: string;
  staked: string;
  pending: string;
  withdrawable: string;
};

export type BalanceView = {
  kind: 'sample' | 'live' | 'empty';
  total: string | null;
  available: string | null;
  availableYocto: string | null;
  staked: string | null;
  pending: string | null;
  withdrawable: string | null;
  locked: string | null;
  loading: boolean;
  error: string;
  note: string;
  partial: boolean;
  pools: PoolView[];
};

function liveFromRead(read: AccountRead): Pick<BalanceView, 'total' | 'available' | 'availableYocto' | 'staked' | 'pending' | 'withdrawable' | 'locked' | 'note' | 'partial' | 'pools'> {
  if (read.accountMissing) {
    return {
      total: null,
      available: null,
      availableYocto: null,
      staked: null,
      pending: null,
      withdrawable: null,
      locked: null,
      note: read.stakingNote,
      partial: false,
      pools: [],
    };
  }

  const stakingKnown = read.stakedYocto != null && read.pendingYocto != null && read.withdrawableYocto != null;
  const stakeSum = stakingKnown ? read.stakedYocto! + read.pendingYocto! + read.withdrawableYocto! : 0n;
  const total = read.liquidYocto + read.lockedYocto + stakeSum;
  const notes = [read.stakingNote];
  if (read.lockedYocto > 0n) notes.push(`Includes ${formatNear(read.lockedYocto)} NEAR locked on this account.`);
  if (!stakingKnown) notes.push('The total omits staking positions because those balances could not be read.');
  return {
    total: formatNear(total),
    available: read.availableYocto == null ? null : formatNear(read.availableYocto),
    availableYocto: read.availableYocto == null ? null : read.availableYocto.toString(),
    staked: read.stakedYocto == null ? null : formatNear(read.stakedYocto),
    pending: read.pendingYocto == null ? null : formatNear(read.pendingYocto),
    withdrawable: read.withdrawableYocto == null ? null : formatNear(read.withdrawableYocto),
    locked: formatNear(read.lockedYocto),
    note: notes.filter(Boolean).join(' '),
    partial: read.totalPartial || !stakingKnown,
    pools: read.pools.map((pool) => ({
      id: pool.id,
      staked: formatNear(pool.stakedYocto),
      pending: formatNear(pool.pendingYocto),
      withdrawable: formatNear(pool.withdrawableYocto),
    })),
  };
}

export function buildBalance(input: {
  sample: boolean;
  accountId: string | null;
  read: AccountRead | null;
  loading: boolean;
  error: string;
}): BalanceView {
  if (input.accountId) {
    const live = input.read ? liveFromRead(input.read) : {
      total: null,
      available: null,
      availableYocto: null,
      staked: null,
      pending: null,
      withdrawable: null,
      locked: null,
      note: '',
      partial: false,
      pools: [],
    };
    return { kind: 'live', loading: input.loading, error: input.error, ...live };
  }
  if (input.sample) {
    return {
      kind: 'sample',
      total: sampleWallet.total,
      available: sampleWallet.available,
      availableYocto: null,
      staked: sampleWallet.staked,
      pending: sampleWallet.pending,
      withdrawable: null,
      locked: null,
      loading: false,
      error: '',
      note: 'Example figures. They are not your balances.',
      partial: false,
      pools: [],
    };
  }
  return {
    kind: 'empty',
    total: null,
    available: null,
    availableYocto: null,
    staked: null,
    pending: null,
    withdrawable: null,
    locked: null,
    loading: false,
    error: input.error,
    note: '',
    partial: false,
    pools: [],
  };
}

export function nearLine(balance: BalanceView, key: 'total' | 'available' | 'staked' | 'pending'): string {
  if (balance.kind === 'empty') return '—';
  if (balance.kind === 'sample') {
    const value = balance[key];
    return value ? `${value} NEAR` : '—';
  }
  if (balance.loading && !balance[key]) return 'Reading…';
  if (balance.error && !balance[key]) return 'Unavailable';
  const value = balance[key];
  return value ? `${value} NEAR` : 'Unavailable';
}
