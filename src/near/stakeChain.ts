import { isNearAccount } from '../logic';
import type { NetworkId } from './chain';
import { formatNear, parseYocto } from './format';
import {
  chainSucceeded,
  formatCommission,
  parseFeeFraction,
  poolLabel,
  stakeActionMatches,
  stakeRecorded,
} from './stakePlan';

export type StakePool = {
  id: string;
  label: string;
  commission: string;
  fraction: string;
  poolStake: string;
  /** `open` only when the pool contract returned is_staking_paused false. */
  staking: 'open' | 'unread';
};

type RpcFailure = { ok: false };
type RpcSuccess = { ok: true; result: unknown };

const RPC: Record<NetworkId, string[]> = {
  mainnet: ['https://rpc.mainnet.fastnear.com', 'https://rpc.mainnet.near.org'],
  testnet: ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org'],
};

async function nearRpc(network: NetworkId, method: string, params: unknown, timeoutMs: number): Promise<RpcSuccess | RpcFailure> {
  for (const url of RPC[network]) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'near-easy', method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as { result?: unknown; error?: unknown };
      if (body.error || body.result == null) continue;
      return { ok: true, result: body.result };
    } catch {
      /* Try the next public endpoint. */
    }
  }
  return { ok: false };
}

function decodeResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const bytes = (result as { result?: unknown }).result;
  if (!Array.isArray(bytes) || bytes.some((value) => typeof value !== 'number')) return null;
  return new TextDecoder().decode(Uint8Array.from(bytes as number[])).trim();
}

async function viewCall(network: NetworkId, accountId: string, method: string, args: Record<string, unknown>): Promise<string | null> {
  const outcome = await nearRpc(network, 'query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: accountId,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  }, 12000);
  if (!outcome.ok) return null;
  const record = outcome.result as { result?: unknown; error?: unknown };
  if (record.error) return null;
  return decodeResult(outcome.result);
}

function asYocto(text: string | null): bigint | null {
  if (!text) return null;
  const match = text.match(/^"?(\d+)"?$/);
  if (!match) return null;
  return parseYocto(match[1]);
}

async function mapLimited<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await run(current);
    }
  });
  await Promise.all(workers);
}

export async function loadStakePools(network: NetworkId): Promise<StakePool[]> {
  const listed = await nearRpc(network, 'validators', [null], 15000);
  if (!listed.ok || !listed.result || typeof listed.result !== 'object') {
    throw new Error('The NEAR network could not be reached.');
  }
  const current = (listed.result as { current_validators?: unknown }).current_validators;
  if (!Array.isArray(current)) throw new Error('The NEAR network could not be reached.');

  const seats = current.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const id = (item as { account_id?: unknown }).account_id;
    const stake = (item as { stake?: unknown }).stake;
    if (typeof id !== 'string' || !isNearAccount(id)) return [];
    return [{ id, stake: typeof stake === 'string' ? parseYocto(stake) ?? 0n : 0n }];
  });
  const delegating = seats.filter((seat) => seat.id.includes('.pool'));
  const candidates = (delegating.length ? delegating : seats).sort((a, b) => (a.stake > b.stake ? -1 : 1)).slice(0, 16);
  const pools: StakePool[] = [];

  await mapLimited(candidates, 4, async (seat) => {
    const feeText = await viewCall(network, seat.id, 'get_reward_fee_fraction', {});
    const fee = feeText ? parseFeeFraction(feeText) : null;
    if (!fee) return;
    const pausedText = await viewCall(network, seat.id, 'is_staking_paused', {});
    if (pausedText === 'true') return;
    const commission = formatCommission(fee.numerator, fee.denominator);
    if (!commission) return;
    const totalText = await viewCall(network, seat.id, 'get_total_staked_balance', {});
    const total = asYocto(totalText);
    pools.push({
      id: seat.id,
      label: poolLabel(seat.id),
      commission,
      fraction: `${fee.numerator.toString()}/${fee.denominator.toString()}`,
      poolStake: total == null ? 'Unavailable' : `${formatNear(total)} NEAR`,
      staking: pausedText === 'false' ? 'open' : 'unread',
    });
  });

  pools.sort((a, b) => a.commission.localeCompare(b.commission, undefined, { numeric: true }) || a.label.localeCompare(b.label));
  return pools.slice(0, 12);
}

/** Return the uniquely named pool. An empty preference does not select one. */
export function chooseStakePool(pools: StakePool[], preference: string | null): StakePool | null {
  const named = preference?.trim().toLowerCase() ?? '';
  if (!named) return null;
  const exact = pools.find((pool) => pool.id.toLowerCase() === named || pool.label.toLowerCase() === named);
  if (exact) return exact;
  const partial = pools.filter((pool) => pool.id.toLowerCase().includes(named) || pool.label.toLowerCase().includes(named));
  return partial.length === 1 ? partial[0] : null;
}

export async function readAccountStaked(network: NetworkId, poolId: string, accountId: string): Promise<bigint | null> {
  const text = await viewCall(network, poolId, 'get_account_staked_balance', { account_id: accountId });
  return asYocto(text);
}

export type StakeConfirmation =
  | { ok: true; hash: string; stakedYocto: bigint }
  | { ok: false; kind: 'failed' | 'unconfirmed'; hash: string | null; message: string };

export async function confirmStake(input: {
  network: NetworkId;
  hash: string | null;
  signerId: string;
  poolId: string;
  amountYocto: bigint;
  previousStakedYocto: bigint | null;
}): Promise<StakeConfirmation> {
  if (!input.hash) {
    return { ok: false, kind: 'unconfirmed', hash: null, message: 'The wallet did not return a transaction hash. Success is not shown.' };
  }
  const status = await nearRpc(input.network, 'tx', {
    tx_hash: input.hash,
    sender_account_id: input.signerId,
    wait_until: 'FINAL',
  }, 45000);
  const fallback = status.ok ? status : await nearRpc(input.network, 'EXPERIMENTAL_tx_status', [input.hash, input.signerId], 20000);
  if (!fallback.ok) {
    return {
      ok: false,
      kind: 'unconfirmed',
      hash: input.hash,
      message: 'The transaction could not be read back from NEAR. Success is not shown.',
    };
  }
  if (!chainSucceeded(fallback.result)) {
    return { ok: false, kind: 'failed', hash: input.hash, message: 'The transaction failed on NEAR. The stake was not confirmed.' };
  }
  if (!stakeActionMatches(fallback.result, input.poolId, input.signerId, input.amountYocto)) {
    return { ok: false, kind: 'failed', hash: input.hash, message: 'The transaction on NEAR was not a stake to the selected pool.' };
  }
  const next = await readAccountStaked(input.network, input.poolId, input.signerId);
  if (!stakeRecorded(input.previousStakedYocto, next, input.amountYocto) || next == null) {
    return {
      ok: false,
      kind: 'unconfirmed',
      hash: input.hash,
      message: 'NEAR executed a transaction, but the staked balance did not increase. Success is not shown.',
    };
  }
  return { ok: true, hash: input.hash, stakedYocto: next };
}
