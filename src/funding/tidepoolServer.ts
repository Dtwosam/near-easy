import { ApiError, OneClickService, OpenAPI, QuoteRequest } from '@defuse-protocol/one-click-sdk-typescript';
import {
  TIDEPOOL_ORIGIN,
  catalogFromTokens,
  findToken,
  isDepositAddress,
  isDepositHash,
  isNearTestnetAccount,
  isOriginAddress,
  isTestnetAssetId,
  parseFundingAmount,
  publicQuote,
  quoteDeadline,
  toBaseUnits,
} from './plan';
import type { FundingCatalog, FundingStatus, FundingToken, PublicQuote } from './plan';
import { parseStatusPayload } from './plan';

if (typeof window !== 'undefined') {
  throw new Error('Tidepool calls stay on the server.');
}

export class FundingError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TokenCache = { at: number; tokens: FundingToken[] };
let cache: TokenCache | null = null;

export function lockTidepool(): void {
  OpenAPI.BASE = TIDEPOOL_ORIGIN;
  OpenAPI.TOKEN = undefined;
  if (OpenAPI.BASE !== TIDEPOOL_ORIGIN) {
    throw new FundingError(500, 'Funding is locked to the Tidepool testnet.');
  }
}

function cleanMessage(error: unknown): { status: number; message: string } {
  if (error instanceof FundingError) return { status: error.status, message: error.message };
  if (error instanceof ApiError) {
    const body = error.body as { message?: unknown } | undefined;
    const raw = typeof body?.message === 'string' ? body.message : 'Tidepool rejected the request.';
    const message = raw.replace(/\s+/g, ' ').replace(/https?:\/\/\S+/g, '').trim().slice(0, 240);
    const status = error.status >= 400 && error.status < 500 ? 400 : 502;
    return { status, message: message || 'Tidepool rejected the request.' };
  }
  return { status: 502, message: 'Tidepool could not be reached.' };
}

export function explainTidepool(error: unknown): { status: number; message: string } {
  return cleanMessage(error);
}

async function loadTokens(): Promise<FundingToken[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.tokens;
  lockTidepool();
  const rows = await OneClickService.getTokens();
  const tokens = catalogFromTokens(rows).tokens;
  if (!tokens.length) throw new FundingError(502, 'Tidepool returned no testnet tokens.');
  cache = { at: Date.now(), tokens };
  return tokens;
}

export async function tidepoolCatalog(): Promise<FundingCatalog> {
  return catalogFromTokens(await loadTokens());
}

export async function tidepoolQuote(input: {
  dry: boolean;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  refundTo: string;
  recipient: string;
}): Promise<PublicQuote> {
  if (!isTestnetAssetId(input.originAsset) || !isTestnetAssetId(input.destinationAsset)) {
    throw new FundingError(400, 'Only Tidepool testnet assets can be quoted.');
  }
  if (!parseFundingAmount(input.amount)) throw new FundingError(400, 'Enter an amount greater than zero.');
  const tokens = await loadTokens();
  const origin = findToken(tokens, input.originAsset);
  const destination = findToken(tokens, input.destinationAsset);
  if (!origin || !destination) throw new FundingError(400, 'That token is not in the current Tidepool testnet list.');
  if (destination.blockchain !== 'near') throw new FundingError(400, 'Funding pays out only to a NEAR testnet token.');
  const recipient = input.recipient.trim().toLowerCase();
  const refundTo = origin.blockchain === 'near' ? input.refundTo.trim().toLowerCase() : input.refundTo.trim();
  if (!isNearTestnetAccount(recipient)) {
    throw new FundingError(400, 'The recipient must be a NEAR testnet account, such as name.testnet.');
  }
  if (!isOriginAddress(origin.blockchain, refundTo)) {
    throw new FundingError(400, `Enter a ${origin.blockchain === 'near' ? 'NEAR testnet' : chainRefundName(origin.blockchain)} refund address.`);
  }
  const amount = toBaseUnits(input.amount, origin.decimals);
  if (!amount) throw new FundingError(400, `This token uses ${origin.decimals} decimal places.`);
  const depositType = origin.blockchain === 'near' ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN;
  const memoChain = origin.blockchain === 'stellar' || origin.blockchain === 'xrp';
  lockTidepool();
  const response = await OneClickService.getQuote({
    dry: input.dry,
    swapType: QuoteRequest.swapType.EXACT_INPUT,
    slippageTolerance: 100,
    originAsset: origin.assetId,
    destinationAsset: destination.assetId,
    amount,
    depositType,
    depositMode: memoChain ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
    refundTo,
    refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
    recipient,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    deadline: quoteDeadline(origin.blockchain),
    referral: 'near-easy',
  });
  const quote = publicQuote({
    body: response,
    origin,
    destination,
    dry: input.dry,
    refundTo,
    recipient,
    depositType: origin.blockchain === 'near' ? 'INTENTS' : 'ORIGIN_CHAIN',
  });
  if (!quote) throw new FundingError(502, 'Tidepool returned a quote this app could not verify.');
  if (OpenAPI.BASE !== TIDEPOOL_ORIGIN) throw new FundingError(500, 'Funding is locked to the Tidepool testnet.');
  return quote;
}

function chainRefundName(blockchain: string): string {
  if (blockchain === 'sol') return 'Solana devnet';
  if (blockchain === 'base') return 'Base Sepolia';
  if (blockchain === 'arb') return 'Arbitrum Sepolia';
  if (blockchain === 'eth') return 'Ethereum Sepolia';
  return 'testnet';
}

export async function tidepoolStatus(depositAddress: string, depositMemo?: string): Promise<FundingStatus> {
  if (!isDepositAddress(depositAddress)) throw new FundingError(400, 'That deposit address cannot be checked.');
  const memo = depositMemo?.trim() || undefined;
  if (memo && !/^[a-zA-Z0-9._:-]{1,128}$/.test(memo)) throw new FundingError(400, 'That memo cannot be checked.');
  lockTidepool();
  const response = await OneClickService.getExecutionStatus(depositAddress, memo);
  const status = parseStatusPayload(response);
  if (!status) throw new FundingError(502, 'Tidepool returned a status this app could not verify.');
  return status;
}

export async function tidepoolSubmit(input: { txHash: string; depositAddress: string; memo?: string; nearSenderAccount?: string }): Promise<FundingStatus> {
  const txHash = input.txHash.trim();
  if (!isDepositHash(txHash)) throw new FundingError(400, 'Enter the transaction hash from your wallet.');
  if (!isDepositAddress(input.depositAddress)) throw new FundingError(400, 'That deposit address cannot be checked.');
  const memo = input.memo?.trim() || undefined;
  const nearSenderAccount = input.nearSenderAccount?.trim().toLowerCase() || undefined;
  if (nearSenderAccount && !isNearTestnetAccount(nearSenderAccount)) {
    throw new FundingError(400, 'The NEAR sender must be a testnet account.');
  }
  lockTidepool();
  const response = await OneClickService.submitDepositTx({
    txHash,
    depositAddress: input.depositAddress.trim(),
    memo,
    nearSenderAccount,
  });
  const status = parseStatusPayload(response);
  if (!status) throw new FundingError(502, 'Tidepool returned a status this app could not verify.');
  return status;
}

export async function tidepoolFaucet(input: { chain?: string; address?: string; accountId?: string }): Promise<string> {
  lockTidepool();
  let payload: Record<string, string>;
  if (input.accountId) {
    const accountId = input.accountId.trim().toLowerCase();
    if (!isNearTestnetAccount(accountId)) throw new FundingError(400, 'The faucet needs a NEAR testnet account.');
    payload = { accountId, mode: 'wallet' };
  } else if (input.chain && input.address) {
    const chain = input.chain.trim();
    if (!['sol', 'base', 'arb', 'eth', 'stellar', 'sui'].includes(chain)) {
      throw new FundingError(400, 'This faucet supports Solana devnet, the Sepolia networks, Stellar testnet, and Sui testnet.');
    }
    if (!isOriginAddress(chain, input.address)) throw new FundingError(400, 'That faucet address does not match the test network.');
    payload = { chain, address: input.address.trim() };
  } else {
    throw new FundingError(400, 'Enter the testnet address that should receive test tokens.');
  }
  const response = await fetch(`${TIDEPOOL_ORIGIN}/v0/faucet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null) as { message?: unknown; error?: unknown; txHash?: unknown; hash?: unknown } | null;
  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : 'The faucet request was not accepted.';
    throw new FundingError(response.status >= 500 ? 502 : 400, message.replace(/\s+/g, ' ').slice(0, 240));
  }
  const hash = typeof body?.txHash === 'string' ? body.txHash : typeof body?.hash === 'string' ? body.hash : '';
  const message = typeof body?.message === 'string' ? body.message.replace(/\s+/g, ' ').slice(0, 240) : '';
  return [message, hash ? `Transaction ${hash}` : ''].filter(Boolean).join(' ')
    || 'Tidepool accepted the faucet request. This is not a cross-chain transfer.';
}
