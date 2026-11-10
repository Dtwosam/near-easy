import { chainSucceeded } from '../near/stakePlan';
import { isDepositHash, trustedExplorer, VERIFIER_ACCOUNT } from './plan';

/** Solana devnet genesis. A mainnet signature is never broadcast from this app. */
export const SOLANA_DEVNET_CHAIN = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
export const ERC20_TRANSFER = 'a9059cbb';

const REFUSED_EVM_CONTRACTS = new Set([
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
]);

const REFUSED_SOL_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

export type OriginState = 'confirmed' | 'pending' | 'missing' | 'failed' | 'mismatch';

export type OriginCheck = {
  state: OriginState;
  hash: string;
  detail: string;
};

export type TransferSource = {
  dry: boolean;
  originBlockchain: string;
  depositType: string;
  depositAddress: string | null;
  contractAddress: string | null;
  amountIn: string;
};

export type EvmCall = {
  chainId: 84532;
  to: string;
  data: string;
  value: string;
};

export function isSolanaSignature(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(value.trim());
}

export function isEvmHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export function isNearHash(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value.trim());
}

export function parseEvmChainId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) return Number.parseInt(value, 16);
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function isBaseSepolia(value: unknown): boolean {
  return parseEvmChainId(value) === BASE_SEPOLIA_CHAIN_ID;
}

export function assertSolanaDevnetRpc(url: string) {
  if (url !== SOLANA_DEVNET_RPC) throw new Error('Only Solana devnet can be used.');
}

export function encodeErc20Transfer(to: string, amount: bigint): string | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to) || amount <= 0n) return null;
  const address = to.slice(2).toLowerCase().padStart(64, '0');
  const value = amount.toString(16).padStart(64, '0');
  return `0x${ERC20_TRANSFER}${address}${value}`;
}

export function evmTransferCall(quote: TransferSource): EvmCall | null {
  if (quote.dry || quote.originBlockchain !== 'base' || quote.depositType !== 'ORIGIN_CHAIN') return null;
  if (!quote.depositAddress || !/^0x[0-9a-fA-F]{40}$/.test(quote.depositAddress)) return null;
  if (!/^\d+$/.test(quote.amountIn) || quote.amountIn === '0') return null;
  const amount = BigInt(quote.amountIn);
  const value = `0x${amount.toString(16)}`;
  if (!quote.contractAddress) {
    return { chainId: BASE_SEPOLIA_CHAIN_ID, to: quote.depositAddress.toLowerCase(), data: '0x', value };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(quote.contractAddress)) return null;
  const contract = quote.contractAddress.toLowerCase();
  if (REFUSED_EVM_CONTRACTS.has(contract)) return null;
  const data = encodeErc20Transfer(quote.depositAddress, amount);
  if (!data) return null;
  return { chainId: BASE_SEPOLIA_CHAIN_ID, to: contract, data, value: '0x0' };
}

function hexAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^0x[0-9a-fA-F]+$/.test(text)) return BigInt(text);
  if (/^\d+$/.test(text)) return BigInt(text);
  return null;
}

function sameCalldata(left: string, right: string): boolean {
  const empty = (value: string) => value === '' || value === '0x' || value === '0x0';
  if (empty(left) && empty(right)) return true;
  return left.toLowerCase() === right.toLowerCase();
}

export function parseBaseDeposit(tx: unknown, receipt: unknown, expected: EvmCall & { hash: string }): OriginCheck {
  const hash = expected.hash;
  if (!isEvmHash(hash) || expected.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    return { state: 'mismatch', hash, detail: 'This transfer is not a Base Sepolia deposit.' };
  }
  if (tx == null && receipt == null) {
    return { state: 'pending', hash, detail: 'Base Sepolia has not confirmed this transaction yet.' };
  }
  if (!tx || typeof tx !== 'object') {
    return { state: 'pending', hash, detail: 'Base Sepolia has not confirmed this transaction yet.' };
  }
  const record = tx as { hash?: unknown; to?: unknown; input?: unknown; value?: unknown };
  if (!receipt || typeof receipt !== 'object') {
    return { state: 'pending', hash, detail: 'Base Sepolia has not confirmed this transaction yet.' };
  }
  const status = hexAmount((receipt as { status?: unknown }).status);
  if (status == null) return { state: 'pending', hash, detail: 'Base Sepolia has not confirmed this transaction yet.' };
  if (status !== 1n) return { state: 'failed', hash, detail: 'The transaction failed on Base Sepolia.' };
  const returned = typeof record.hash === 'string' ? record.hash.toLowerCase() : hash.toLowerCase();
  if (returned !== hash.toLowerCase()) {
    return { state: 'mismatch', hash, detail: 'Base Sepolia returned a different transaction.' };
  }
  const to = typeof record.to === 'string' ? record.to.toLowerCase() : '';
  const value = hexAmount(record.value);
  const expectedValue = hexAmount(expected.value);
  const input = typeof record.input === 'string' ? record.input : '';
  if (to !== expected.to.toLowerCase() || value == null || expectedValue == null || value !== expectedValue || !sameCalldata(input, expected.data)) {
    return { state: 'mismatch', hash, detail: 'This Base Sepolia transaction does not match the quoted deposit.' };
  }
  return { state: 'confirmed', hash, detail: 'Base Sepolia confirmed this deposit transaction.' };
}

function accountKey(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { pubkey?: unknown }).pubkey === 'string') {
    return (value as { pubkey: string }).pubkey;
  }
  return null;
}

function tokenCredits(rows: unknown): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  if (!Array.isArray(rows)) return totals;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { owner?: unknown; mint?: unknown; uiTokenAmount?: { amount?: unknown } };
    if (typeof record.owner !== 'string' || typeof record.mint !== 'string') continue;
    const amount = record.uiTokenAmount?.amount;
    if (typeof amount !== 'string' || !/^\d+$/.test(amount)) continue;
    const key = `${record.owner}|${record.mint}`;
    totals.set(key, (totals.get(key) ?? 0n) + BigInt(amount));
  }
  return totals;
}

export function parseSolanaDeposit(payload: unknown, expected: {
  hash: string;
  depositAddress: string;
  amount: string;
  mint: string | null;
}): OriginCheck {
  const hash = expected.hash;
  if (!isSolanaSignature(hash) || !/^\d+$/.test(expected.amount) || expected.amount === '0') {
    return { state: 'mismatch', hash, detail: 'This transfer is not a Solana devnet deposit.' };
  }
  if (expected.mint && REFUSED_SOL_MINTS.has(expected.mint)) {
    return { state: 'mismatch', hash, detail: 'This mint is not a Tidepool test token.' };
  }
  if (payload == null) return { state: 'pending', hash, detail: 'Solana devnet has not confirmed this transaction yet.' };
  if (!payload || typeof payload !== 'object') {
    return { state: 'pending', hash, detail: 'Solana devnet has not confirmed this transaction yet.' };
  }
  const body = payload as {
    meta?: { err?: unknown; preBalances?: unknown; postBalances?: unknown; preTokenBalances?: unknown; postTokenBalances?: unknown } | null;
    transaction?: { message?: { accountKeys?: unknown }; signatures?: unknown };
  };
  if (!body.meta) return { state: 'pending', hash, detail: 'Solana devnet has not confirmed this transaction yet.' };
  if (body.meta.err != null) return { state: 'failed', hash, detail: 'The transaction failed on Solana devnet.' };
  const wanted = BigInt(expected.amount);
  if (expected.mint) {
    const before = tokenCredits(body.meta.preTokenBalances);
    const after = tokenCredits(body.meta.postTokenBalances);
    const key = `${expected.depositAddress}|${expected.mint}`;
    const credit = (after.get(key) ?? 0n) - (before.get(key) ?? 0n);
    if (credit !== wanted) {
      return { state: 'mismatch', hash, detail: 'This Solana transaction does not credit the deposit address with the quoted token amount.' };
    }
    return { state: 'confirmed', hash, detail: 'Solana devnet confirmed this deposit transaction.' };
  }
  const keys = Array.isArray(body.transaction?.message?.accountKeys)
    ? body.transaction.message.accountKeys.map(accountKey)
    : [];
  const index = keys.indexOf(expected.depositAddress);
  const pre = body.meta.preBalances;
  const post = body.meta.postBalances;
  if (index < 0 || !Array.isArray(pre) || !Array.isArray(post)) {
    return { state: 'mismatch', hash, detail: 'This Solana transaction does not credit the deposit address.' };
  }
  const before = typeof pre[index] === 'number' && Number.isSafeInteger(pre[index]) ? BigInt(pre[index]) : null;
  const after = typeof post[index] === 'number' && Number.isSafeInteger(post[index]) ? BigInt(post[index]) : null;
  if (before == null || after == null || after - before !== wanted) {
    return { state: 'mismatch', hash, detail: 'This Solana transaction does not credit the deposit address with the quoted SOL amount.' };
  }
  return { state: 'confirmed', hash, detail: 'Solana devnet confirmed this deposit transaction.' };
}

function decodeArgs(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string' || !value) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* The chain may return JSON as base64. */
    }
    try {
      const parsed = JSON.parse(atob(value)) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseNearDeposit(result: unknown, expected: {
  hash: string;
  signerId: string;
  receiverId: string;
  amount: string;
  depositAddress: string;
}): OriginCheck {
  const hash = expected.hash;
  if (!isNearHash(hash) || !/^\d+$/.test(expected.amount)) {
    return { state: 'mismatch', hash, detail: 'This transfer is not a NEAR testnet deposit.' };
  }
  if (!result || !chainSucceeded(result)) {
    return { state: 'failed', hash, detail: 'The transaction failed on NEAR testnet.' };
  }
  const transaction = (result as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') {
    return { state: 'mismatch', hash, detail: 'NEAR testnet did not return the deposit transaction.' };
  }
  const tx = transaction as { receiver_id?: unknown; signer_id?: unknown; actions?: unknown };
  if (tx.receiver_id !== expected.receiverId || tx.signer_id !== expected.signerId || !Array.isArray(tx.actions)) {
    return { state: 'mismatch', hash, detail: 'This NEAR transaction does not match the quoted deposit.' };
  }
  const matched = tx.actions.some((action) => {
    if (!action || typeof action !== 'object') return false;
    const call = (action as { FunctionCall?: unknown }).FunctionCall;
    if (!call || typeof call !== 'object') return false;
    const method = (call as { method_name?: unknown }).method_name;
    const deposit = (call as { deposit?: unknown }).deposit;
    if (method !== 'ft_transfer_call' || deposit !== '1') return false;
    const args = decodeArgs((call as { args?: unknown }).args);
    return args?.receiver_id === VERIFIER_ACCOUNT
      && args.amount === expected.amount
      && args.msg === expected.depositAddress;
  });
  if (!matched) return { state: 'mismatch', hash, detail: 'This NEAR transaction does not match the quoted deposit.' };
  return { state: 'confirmed', hash, detail: 'NEAR testnet confirmed this deposit transaction.' };
}

export function originExplorer(blockchain: string, hash: string): string | null {
  const clean = hash.trim();
  if (blockchain === 'sol' && isSolanaSignature(clean)) {
    return trustedExplorer(`https://explorer.solana.com/tx/${clean}?cluster=devnet`);
  }
  if (blockchain === 'base' && isEvmHash(clean)) {
    return trustedExplorer(`https://sepolia.basescan.org/tx/${clean}`);
  }
  if (blockchain === 'near' && isNearHash(clean) && isDepositHash(clean)) {
    return trustedExplorer(`https://testnet.nearblocks.io/txns/${clean}`);
  }
  return null;
}

function originErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return '';
}

function clipOriginDetail(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}...`;
}

export function explainOriginError(error: unknown): string {
  const message = originErrorText(error);
  const lower = message.toLowerCase();
  const detail = message ? clipOriginDetail(message) : '';
  if (/seed phrase|private key|secret key|mnemonic|recovery phrase/.test(lower)) {
    return 'NEAR Easy will not ask for a seed phrase or a private key. Nothing was sent.';
  }
  if (/reject|denied|cancel|closed|dismiss|user rejected|declined/.test(lower)) {
    return 'The wallet declined the transfer. Nothing was confirmed.';
  }
  if (/not on base sepolia|only solana devnet|not on solana devnet|mainnet/.test(lower)) {
    return 'The wallet is not on the required test network. Nothing was sent.';
  }
  if (/insufficient/.test(lower)) {
    return `The wallet does not have enough testnet tokens or fee balance for this transfer. ${detail} Nothing was confirmed.`;
  }
  if (/no solana wallet|no evm wallet|no longer available|not connected|did not return an address/.test(lower)) {
    return 'No testnet wallet is connected. Nothing was sent.';
  }
  if (/cannot sign|devnet transaction/.test(lower)) {
    return 'This wallet cannot sign a testnet transfer for NEAR Easy to submit. Nothing was sent.';
  }
  if (/blockhash|simulation|custom program error|rejected the transfer/.test(lower)) {
    return `The test network rejected the transfer before it could be confirmed. ${detail} Nothing is marked successful.`;
  }
  if (detail) return `${detail} Nothing was confirmed.`;
  return 'The transfer could not be submitted. Nothing was confirmed.';
}

export async function waitForOrigin(load: () => Promise<OriginCheck>, attempts = 10, pauseMs = 3000): Promise<OriginCheck> {
  let last: OriginCheck = { state: 'pending', hash: '', detail: 'The test network has not confirmed this transaction yet.' };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await load();
    } catch {
      last = { state: 'pending', hash: last.hash, detail: 'The test network could not be reached yet.' };
    }
    if (last.state === 'confirmed' || last.state === 'failed' || last.state === 'mismatch' || last.state === 'missing') return last;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  return last;
}
