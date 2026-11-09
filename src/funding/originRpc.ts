import {
  BASE_SEPOLIA_RPC,
  evmTransferCall,
  isEvmHash,
  isNearHash,
  isSolanaSignature,
  parseBaseDeposit,
  parseNearDeposit,
  parseSolanaDeposit,
  SOLANA_DEVNET_RPC,
  assertSolanaDevnetRpc,
} from './originPlan';
import type { OriginCheck, TransferSource } from './originPlan';

const NEAR_TESTNET_RPC = ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org'];
const WNEAR_ACCOUNT = 'wnear.tidepool-sandbox.testnet';
const WRAP_ACCOUNT = 'wrap.testnet';

export type WnearLimitation = {
  convertible: false;
  methodFound: boolean;
  wrapMethodFound: boolean;
  backed: boolean;
  codeHash: string | null;
  wrapCodeHash: string | null;
  detail: string;
};

async function postRpc(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('The test network could not be reached.');
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error) throw new Error('The test network could not be reached.');
  return payload.result ?? null;
}

export async function verifySolanaDeposit(hash: string, expected: {
  depositAddress: string;
  amount: string;
  mint: string | null;
}): Promise<OriginCheck> {
  const signature = hash.trim();
  if (!isSolanaSignature(signature)) {
    return { state: 'missing', hash: signature, detail: 'That is not a Solana devnet signature.' };
  }
  assertSolanaDevnetRpc(SOLANA_DEVNET_RPC);
  const transaction = await postRpc(SOLANA_DEVNET_RPC, {
    jsonrpc: '2.0',
    id: 'near-easy',
    method: 'getTransaction',
    params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
  });
  if (transaction) return parseSolanaDeposit(transaction, { ...expected, hash: signature });
  const statuses = await postRpc(SOLANA_DEVNET_RPC, {
    jsonrpc: '2.0',
    id: 'near-easy',
    method: 'getSignatureStatuses',
    params: [[signature], { searchTransactionHistory: true }],
  });
  const row = statuses && typeof statuses === 'object'
    ? (statuses as { value?: unknown }).value
    : null;
  const status = Array.isArray(row) ? row[0] : null;
  if (status && typeof status === 'object' && (status as { err?: unknown }).err != null) {
    return { state: 'failed', hash: signature, detail: 'The transaction failed on Solana devnet.' };
  }
  return { state: 'pending', hash: signature, detail: 'Solana devnet has not confirmed this transaction yet.' };
}

export async function verifyBaseDeposit(hash: string, quote: TransferSource): Promise<OriginCheck> {
  const txHash = hash.trim();
  if (!isEvmHash(txHash)) return { state: 'missing', hash: txHash, detail: 'That is not a Base Sepolia transaction hash.' };
  const call = evmTransferCall(quote);
  if (!call) return { state: 'mismatch', hash: txHash, detail: 'This quote cannot be checked on Base Sepolia.' };
  const tx = await postRpc(BASE_SEPOLIA_RPC, {
    jsonrpc: '2.0',
    id: 'near-easy',
    method: 'eth_getTransactionByHash',
    params: [txHash],
  });
  const receipt = await postRpc(BASE_SEPOLIA_RPC, {
    jsonrpc: '2.0',
    id: 'near-easy',
    method: 'eth_getTransactionReceipt',
    params: [txHash],
  });
  return parseBaseDeposit(tx, receipt, { ...call, hash: txHash });
}

async function nearTestnet<T>(method: string, params: unknown): Promise<T> {
  let last = 'The NEAR testnet could not be reached.';
  for (const url of NEAR_TESTNET_RPC) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'near-easy', method, params }),
        signal: AbortSignal.timeout(50000),
      });
      if (!response.ok) continue;
      const body = await response.json() as { result?: T; error?: { data?: unknown; message?: unknown } };
      if (body.error) {
        last = typeof body.error.data === 'string' ? body.error.data : 'The NEAR testnet could not read that transaction.';
        continue;
      }
      if (body.result == null) continue;
      return body.result;
    } catch {
      /* Try the next testnet endpoint. */
    }
  }
  throw new Error(last);
}

export async function verifyNearDeposit(hash: string, expected: {
  signerId: string;
  receiverId: string;
  amount: string;
  depositAddress: string;
}): Promise<OriginCheck> {
  const txHash = hash.trim();
  if (!isNearHash(txHash)) return { state: 'missing', hash: txHash, detail: 'That is not a NEAR testnet transaction hash.' };
  try {
    const result = await nearTestnet<unknown>('tx', {
      tx_hash: txHash,
      sender_account_id: expected.signerId,
      wait_until: 'FINAL',
    });
    return parseNearDeposit(result, { ...expected, hash: txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/doesn't exist|does not exist|unknown transaction|Transaction .*? not found/i.test(message)) {
      return { state: 'missing', hash: txHash, detail: 'NEAR testnet has no transaction for this hash.' };
    }
    return { state: 'pending', hash: txHash, detail: 'NEAR testnet could not confirm this transaction yet.' };
  }
}

function viewError(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}

function viewText(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const bytes = (result as { result?: unknown }).result;
  if (!Array.isArray(bytes) || bytes.some((value) => typeof value !== 'number')) return null;
  return new TextDecoder().decode(Uint8Array.from(bytes as number[])).trim();
}

async function nearView(account: string, method: string, args: Record<string, unknown>): Promise<unknown> {
  return nearTestnet('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: account,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
}

async function codeHash(account: string): Promise<string | null> {
  const result = await nearTestnet<{ code_hash?: unknown; amount?: unknown }>('query', {
    request_type: 'view_account',
    finality: 'final',
    account_id: account,
  });
  return typeof result.code_hash === 'string' ? result.code_hash : null;
}

function methodExists(result: unknown): boolean {
  const error = viewError(result);
  if (!error) return true;
  return !/MethodNotFound/.test(error);
}

function jsonBig(text: string | null): bigint | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    const value = typeof parsed === 'string' ? parsed : text;
    return /^\d+$/.test(value) ? BigInt(value) : null;
  } catch {
    const match = text.match(/\d+/);
    return match ? BigInt(match[0]) : null;
  }
}

/**
 * Tidepool test wNEAR is a minted NEP-141. It has no near_withdraw, its code is not wrap.testnet,
 * and the contract balance does not back the supply. This app does not convert it.
 */
export async function readWnearLimitation(): Promise<WnearLimitation> {
  const [withdraw, wrapWithdraw, supplyView, account, wnearHash, wrapHash] = await Promise.all([
    nearView(WNEAR_ACCOUNT, 'near_withdraw', { amount: '1' }),
    nearView(WRAP_ACCOUNT, 'near_withdraw', { amount: '1' }),
    nearView(WNEAR_ACCOUNT, 'ft_total_supply', {}),
    nearTestnet<{ amount?: unknown }>('query', { request_type: 'view_account', finality: 'final', account_id: WNEAR_ACCOUNT }),
    codeHash(WNEAR_ACCOUNT),
    codeHash(WRAP_ACCOUNT),
  ]);
  const supply = jsonBig(viewText(supplyView));
  const balance = typeof account.amount === 'string' && /^\d+$/.test(account.amount) ? BigInt(account.amount) : null;
  if (supply == null || balance == null) throw new Error('The test wNEAR contract could not be read.');
  const methodFound = methodExists(withdraw);
  const wrapMethodFound = methodExists(wrapWithdraw);
  const backed = balance >= supply;
  return {
    convertible: false,
    methodFound,
    wrapMethodFound,
    backed,
    codeHash: wnearHash,
    wrapCodeHash: wrapHash,
    detail: 'Test wNEAR cannot be turned into native NEAR. wnear.tidepool-sandbox.testnet has no near_withdraw method, it is not wrap.testnet, and its balance does not back the token supply. Funding and staking stay separate.',
  };
}
