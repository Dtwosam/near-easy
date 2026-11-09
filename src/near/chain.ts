import { isNearAccount } from '../logic';
import { parseYocto } from './format';

export type NetworkId = 'mainnet' | 'testnet';

export type PoolStake = {
  id: string;
  stakedYocto: bigint;
  pendingYocto: bigint;
  withdrawableYocto: bigint;
};

export type AccountRead = {
  accountMissing: boolean;
  liquidYocto: bigint;
  lockedYocto: bigint;
  availableYocto: bigint | null;
  stakedYocto: bigint | null;
  pendingYocto: bigint | null;
  withdrawableYocto: bigint | null;
  pools: PoolStake[];
  stakingNote: string;
  totalPartial: boolean;
};

const RPC: Record<NetworkId, string[]> = {
  mainnet: ['https://rpc.mainnet.fastnear.com', 'https://rpc.mainnet.near.org'],
  testnet: ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org'],
};

const STAKING_INDEX: Record<NetworkId, string> = {
  mainnet: 'https://api.fastnear.com/v1/account',
  testnet: 'https://test.api.fastnear.com/v1/account',
};

const POOL_LIMIT = 12;

type QueryOutcome = { kind: 'ok'; result: unknown } | { kind: 'missing' } | { kind: 'fail' };

function isMissingAccount(error: unknown): boolean {
  const text = JSON.stringify(error).toLowerCase();
  return text.includes('does not exist') || text.includes('unknown_account') || text.includes('unknown account');
}

async function rpcQuery(network: NetworkId, params: Record<string, unknown>): Promise<QueryOutcome> {
  for (const url of RPC[network]) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'near-easy', method: 'query', params }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as { result?: unknown; error?: unknown };
      if (body.error) {
        if (isMissingAccount(body.error)) return { kind: 'missing' };
        continue;
      }
      if (body.result == null) continue;
      return { kind: 'ok', result: body.result };
    } catch {
      /* Try the next public endpoint. */
    }
  }
  return { kind: 'fail' };
}

function decodeBytes(bytes: number[]): string {
  return new TextDecoder().decode(Uint8Array.from(bytes)).trim();
}

function asYocto(text: string): bigint | null {
  const match = text.match(/^"?(\d+)"?$/);
  if (!match) return null;
  return BigInt(match[1]);
}

async function callPool(network: NetworkId, poolId: string, method: string, accountId: string): Promise<string | null> {
  const outcome = await rpcQuery(network, {
    request_type: 'call_function',
    finality: 'final',
    account_id: poolId,
    method_name: method,
    args_base64: btoa(JSON.stringify({ account_id: accountId })),
  });
  if (outcome.kind !== 'ok' || !outcome.result || typeof outcome.result !== 'object') return null;
  const bytes = (outcome.result as { result?: unknown }).result;
  if (!Array.isArray(bytes) || bytes.some((value) => typeof value !== 'number')) return null;
  return decodeBytes(bytes as number[]);
}

async function listPools(network: NetworkId, accountId: string): Promise<{ id: string }[] | null> {
  try {
    const response = await fetch(`${STAKING_INDEX[network]}/${encodeURIComponent(accountId)}/staking`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { pools?: unknown };
    if (!Array.isArray(body.pools)) return null;
    const ids: { id: string; height: number }[] = [];
    for (const entry of body.pools) {
      if (!entry || typeof entry !== 'object') continue;
      const poolId = (entry as { pool_id?: unknown }).pool_id;
      if (typeof poolId !== 'string' || !isNearAccount(poolId)) continue;
      const height = (entry as { last_update_block_height?: unknown }).last_update_block_height;
      ids.push({ id: poolId, height: typeof height === 'number' ? height : 0 });
    }
    ids.sort((a, b) => b.height - a.height);
    return ids.map((pool) => ({ id: pool.id }));
  } catch {
    return null;
  }
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

export async function readAccount(network: NetworkId, rawAccountId: string): Promise<AccountRead> {
  const accountId = rawAccountId.trim().toLowerCase();
  if (!isNearAccount(accountId)) {
    throw new Error('The wallet returned an account id that cannot be read.');
  }

  const viewed = await rpcQuery(network, {
    request_type: 'view_account',
    finality: 'final',
    account_id: accountId,
  });
  if (viewed.kind === 'fail') throw new Error('The NEAR network could not be reached.');
  if (viewed.kind === 'missing') {
    return {
      accountMissing: true,
      liquidYocto: 0n,
      lockedYocto: 0n,
      availableYocto: null,
      stakedYocto: null,
      pendingYocto: null,
      withdrawableYocto: null,
      pools: [],
      stakingNote: `This account has no on-chain record on ${network}.`,
      totalPartial: false,
    };
  }

  const account = viewed.result as { amount?: unknown; locked?: unknown; storage_usage?: unknown };
  const liquid = typeof account.amount === 'string' ? parseYocto(account.amount) : null;
  const locked = typeof account.locked === 'string' ? parseYocto(account.locked) : null;
  const storage = typeof account.storage_usage === 'number' && Number.isInteger(account.storage_usage) ? BigInt(account.storage_usage) : null;
  if (liquid == null || locked == null || storage == null) {
    throw new Error('The NEAR network returned an error.');
  }
  const storageReserve = storage * 10n ** 19n;
  const available = liquid > storageReserve ? liquid - storageReserve : 0n;

  const empty: AccountRead = {
    accountMissing: false,
    liquidYocto: liquid,
    lockedYocto: locked,
    availableYocto: available,
    stakedYocto: null,
    pendingYocto: null,
    withdrawableYocto: null,
    pools: [],
    stakingNote: '',
    totalPartial: true,
  };

  const listed = await listPools(network, accountId);
  if (listed == null) {
    return {
      ...empty,
      stakingNote: 'Staking pools could not be listed, so staked and pending NEAR are unavailable.',
    };
  }
  if (listed.length === 0) {
    return {
      ...empty,
      stakedYocto: 0n,
      pendingYocto: 0n,
      withdrawableYocto: 0n,
      stakingNote: 'No staking pools found for this account.',
      totalPartial: false,
    };
  }

  const selected = listed.slice(0, POOL_LIMIT);
  const skipped = listed.length - selected.length;
  const pools: PoolStake[] = [];
  const unread: string[] = [];
  let unclassified = false;

  await mapLimited(selected, 4, async (pool) => {
    const stakedText = await callPool(network, pool.id, 'get_account_staked_balance', accountId);
    const unstakedText = await callPool(network, pool.id, 'get_account_unstaked_balance', accountId);
    const staked = stakedText == null ? null : asYocto(stakedText);
    const unstaked = unstakedText == null ? null : asYocto(unstakedText);
    if (staked == null || unstaked == null) {
      unread.push(pool.id);
      return;
    }
    const flagText = await callPool(network, pool.id, 'is_account_unstaked_balance_available', accountId);
    let pending = 0n;
    let withdrawable = 0n;
    if (flagText === 'true') withdrawable = unstaked;
    else {
      pending = unstaked;
      if (flagText !== 'false' && unstaked > 0n) unclassified = true;
    }
    if (staked > 0n || pending > 0n || withdrawable > 0n) {
      pools.push({ id: pool.id, stakedYocto: staked, pendingYocto: pending, withdrawableYocto: withdrawable });
    }
  });

  if (unread.length === selected.length) {
    return {
      ...empty,
      stakingNote: 'Staking balances could not be read, so staked and pending NEAR are unavailable.',
    };
  }

  const stakedYocto = pools.reduce((sum, pool) => sum + pool.stakedYocto, 0n);
  const pendingYocto = pools.reduce((sum, pool) => sum + pool.pendingYocto, 0n);
  const withdrawableYocto = pools.reduce((sum, pool) => sum + pool.withdrawableYocto, 0n);
  const notes: string[] = [];
  if (unread.length) notes.push(`Some pools could not be read (${unread.join(', ')}). Those amounts are not included.`);
  if (skipped > 0) notes.push(`Only the first ${POOL_LIMIT} staking pools were read. Totals do not include the rest.`);
  if (unclassified) notes.push('Some unstaked NEAR could not be classified, so it is counted as pending unstake.');
  if (!notes.length && stakedYocto === 0n && pendingYocto === 0n && withdrawableYocto === 0n) {
    notes.push('Listed pools returned no staked or unstaked NEAR.');
  }

  return {
    accountMissing: false,
    liquidYocto: liquid,
    lockedYocto: locked,
    availableYocto: available,
    stakedYocto,
    pendingYocto,
    withdrawableYocto,
    pools,
    stakingNote: notes.join(' '),
    totalPartial: unread.length > 0 || skipped > 0,
  };
}
