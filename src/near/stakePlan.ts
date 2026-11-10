import { nearToYocto } from './format';

/** 300 TGas, the maximum a NEAR transaction can attach. Unused gas is refunded. */
export const STAKE_GAS = '300000000000000';

/**
 * Liquid NEAR kept back from the stake so the account can prepay gas.
 * Storage rent is already removed from the available balance.
 * 300 TGas costs 0.03 NEAR at the minimum gas price. 0.05 NEAR covers that and a small buffer.
 */
export const FEE_RESERVE_YOCTO = 50_000_000_000_000_000_000_000n;

/** A confirmed testnet stake does not enable mainnet. */
export const MAINNET_STAKING_ENABLED = false;

const TX_HASH = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export type StakeActivity = {
  hash: string;
  accountId: string;
  network: 'mainnet' | 'testnet';
  poolId: string;
  amount: string;
  commission: string;
  when: string;
};

/**
 * NEAR testnet finalized this deposit_and_stake on 2026-11-10.
 * Receipt logs show the pool total stake rose by the 0.02 NEAR deposit.
 * The account stake at the pool is the same figure those logs recorded.
 */
export const verifiedTestnetStake: StakeActivity = {
  hash: '9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV',
  accountId: 'roundwheat3869.testnet',
  network: 'testnet',
  poolId: 'pennyvalidators.pool.f863973.m0',
  amount: '0.02',
  commission: '4%',
  when: '2026-11-10T12:01:24.537Z',
};

export function stakingEnabled(network: 'mainnet' | 'testnet'): boolean {
  return network === 'testnet' || MAINNET_STAKING_ENABLED;
}

export function stakeableYocto(availableYocto: bigint): bigint {
  if (availableYocto <= FEE_RESERVE_YOCTO) return 0n;
  return availableYocto - FEE_RESERVE_YOCTO;
}

export function formatCommission(numerator: bigint, denominator: bigint): string | null {
  if (denominator <= 0n || numerator < 0n || numerator > denominator) return null;
  const hundredths = (numerator * 10000n) / denominator;
  const whole = hundredths / 100n;
  const fraction = hundredths % 100n;
  if (fraction === 0n) return `${whole.toString()}%`;
  const digits = fraction.toString().padStart(2, '0').replace(/0$/, '');
  return `${whole.toString()}.${digits}%`;
}

export function parseFeeFraction(text: string): { numerator: bigint; denominator: bigint } | null {
  try {
    const parsed = JSON.parse(text) as { numerator?: unknown; denominator?: unknown };
    if (typeof parsed.numerator !== 'number' && typeof parsed.numerator !== 'string') return null;
    if (typeof parsed.denominator !== 'number' && typeof parsed.denominator !== 'string') return null;
    const numerator = BigInt(parsed.numerator);
    const denominator = BigInt(parsed.denominator);
    if (!formatCommission(numerator, denominator)) return null;
    return { numerator, denominator };
  } catch {
    return null;
  }
}

export function poolLabel(id: string): string {
  const head = id.split('.')[0]?.trim();
  return head || id;
}

export function stakeCall(amountYocto: bigint): {
  type: 'FunctionCall';
  params: { methodName: 'deposit_and_stake'; args: Record<string, never>; gas: string; deposit: string };
} {
  return {
    type: 'FunctionCall',
    params: {
      methodName: 'deposit_and_stake',
      args: {},
      gas: STAKE_GAS,
      deposit: amountYocto.toString(),
    },
  };
}

export function transactionHash(outcome: unknown): string | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const record = outcome as Record<string, unknown>;
  const transaction = record.transaction;
  if (transaction && typeof transaction === 'object') {
    const hash = (transaction as { hash?: unknown }).hash;
    if (typeof hash === 'string' && TX_HASH.test(hash)) return hash;
  }
  const nested = record.transaction_outcome;
  if (nested && typeof nested === 'object') {
    const id = (nested as { id?: unknown }).id;
    if (typeof id === 'string' && TX_HASH.test(id)) return id;
  }
  return null;
}

function statuses(value: unknown, found: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 8 || !value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) statuses(item, found, depth + 1);
    return found;
  }
  const record = value as Record<string, unknown>;
  if ('SuccessValue' in record || 'SuccessReceiptId' in record || 'Failure' in record) found.push(record);
  for (const key of ['status', 'final_execution_status', 'transaction_outcome', 'receipts_outcome', 'outcome']) {
    if (key in record) statuses(record[key], found, depth + 1);
  }
  return found;
}

export function chainSucceeded(result: unknown): boolean {
  const found = statuses(result);
  if (!found.length || found.some((status) => 'Failure' in status)) return false;
  return found.some((status) => 'SuccessValue' in status || 'SuccessReceiptId' in status);
}

export function stakeActionMatches(result: unknown, poolId: string, signerId: string, amountYocto: bigint): boolean {
  if (!result || typeof result !== 'object') return false;
  const transaction = (result as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') return false;
  const tx = transaction as { receiver_id?: unknown; signer_id?: unknown; actions?: unknown };
  if (tx.receiver_id !== poolId || tx.signer_id !== signerId || !Array.isArray(tx.actions)) return false;
  return tx.actions.some((action) => {
    if (!action || typeof action !== 'object') return false;
    const call = (action as { FunctionCall?: unknown }).FunctionCall;
    if (!call || typeof call !== 'object') return false;
    const method = (call as { method_name?: unknown }).method_name;
    const deposit = (call as { deposit?: unknown }).deposit;
    if (method !== 'deposit_and_stake') return false;
    try {
      return typeof deposit === 'string' && BigInt(deposit) === amountYocto;
    } catch {
      return false;
    }
  });
}

/** A confirmed stake must move the pool balance up. A missing read is not success. */
export function stakeRecorded(previous: bigint | null, next: bigint | null, amountYocto: bigint): boolean {
  if (next == null || amountYocto <= 0n) return false;
  if (previous == null) return next + 10n ** 21n >= amountYocto;
  return next > previous;
}

export function explainStakeError(error: unknown): { kind: 'rejected' | 'network' | 'failed'; message: string } {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (/reject|denied|cancel|closed|dismiss|user rejected/.test(lower)) {
    return { kind: 'rejected', message: 'The wallet declined the stake. Nothing was submitted.' };
  }
  if (/mainnet staking is not enabled/.test(lower)) {
    return { kind: 'failed', message: 'Mainnet staking is not enabled. Nothing was submitted.' };
  }
  if (/does not match/.test(lower)) {
    return { kind: 'failed', message: 'The connected wallet does not match this account. Nothing was submitted.' };
  }
  if (/not connected|no accounts|sign in|no wallet selected|wallet not found/.test(lower)) {
    return { kind: 'failed', message: 'No wallet is connected for this network. Nothing was submitted.' };
  }
  if (/timeout|failed to fetch|network|could not be reached|manifest/.test(lower)) {
    return { kind: 'network', message: 'The wallet or network could not be reached. Nothing was confirmed.' };
  }
  return { kind: 'failed', message: 'The stake could not be submitted. Nothing was confirmed.' };
}

export function parseStakeAmount(value: string): bigint | null {
  const yocto = nearToYocto(value);
  if (yocto == null || yocto <= 0n) return null;
  return yocto;
}

const ACTIVITY_KEY = 'near-easy-stakes';

export function readStakeActivity(): StakeActivity[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<StakeActivity>;
      if (row.network !== 'mainnet' && row.network !== 'testnet') return [];
      if (typeof row.hash !== 'string' || !TX_HASH.test(row.hash)) return [];
      if (typeof row.accountId !== 'string' || typeof row.poolId !== 'string') return [];
      if (typeof row.amount !== 'string' || typeof row.commission !== 'string' || typeof row.when !== 'string') return [];
      return [{
        hash: row.hash,
        accountId: row.accountId,
        network: row.network,
        poolId: row.poolId,
        amount: row.amount,
        commission: row.commission,
        when: row.when,
      }];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

export function saveStakeActivity(entry: StakeActivity) {
  try {
    const next = [entry, ...readStakeActivity().filter((item) => item.hash !== entry.hash)].slice(0, 20);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    /* The on-chain stake still stands if this browser cannot store the row. */
  }
}

export function explorerTx(network: 'mainnet' | 'testnet', hash: string): string {
  const host = network === 'testnet' ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io';
  return `${host}/txns/${hash}`;
}

export function explorerAccount(network: 'mainnet' | 'testnet', accountId: string): string {
  const host = network === 'testnet' ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io';
  return `${host}/address/${accountId}`;
}
