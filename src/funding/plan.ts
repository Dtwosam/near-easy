/** Tidepool testnet funding. Amounts and statuses come from the API response. */

export const TIDEPOOL_ORIGIN = 'https://www.usetidepool.tech';
export const VERIFIER_ACCOUNT = 'verifier.tidepool-sandbox.testnet';
export const FUNDING_GAS = '100000000000000';

export const CHAIN_LABELS: Record<string, string> = {
  sol: 'Solana devnet',
  base: 'Base Sepolia',
  arb: 'Arbitrum Sepolia',
  eth: 'Ethereum Sepolia',
  near: 'NEAR testnet',
  stellar: 'Stellar testnet',
  sui: 'Sui testnet',
  btc: 'Bitcoin testnet4',
  xrp: 'XRP Ledger testnet',
};

const CHAIN_ORDER = ['sol', 'base', 'arb', 'eth', 'near', 'stellar', 'sui', 'btc', 'xrp'];

const EVM_CHAINS: Record<string, { chainId: number; explorer: string }> = {
  base: { chainId: 84532, explorer: 'https://sepolia.basescan.org' },
  arb: { chainId: 421614, explorer: 'https://sepolia.arbiscan.io' },
  eth: { chainId: 11155111, explorer: 'https://sepolia.etherscan.io' },
};

const STATUSES = new Set([
  'PENDING_DEPOSIT',
  'KNOWN_DEPOSIT_TX',
  'INCOMPLETE_DEPOSIT',
  'PROCESSING',
  'SUCCESS',
  'REFUNDED',
  'FAILED',
]);

const EXPLORER_HOSTS = new Set([
  'testnet.nearblocks.io',
  'explorer.solana.com',
  'sepolia.basescan.org',
  'sepolia.arbiscan.io',
  'sepolia.etherscan.io',
  'stellar.expert',
  'testnet.stellarchain.io',
  'suiscan.xyz',
  'testnet.suivision.xyz',
  'mempool.space',
  'blockstream.info',
  'testnet.xrpl.org',
]);

export type FundingToken = {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  contractAddress: string | null;
};

export type FundingCatalog = {
  provider: 'Tidepool';
  affiliate: 'Community-operated. Not affiliated with NEAR.';
  mainnet: false;
  stakeableNativeNear: false;
  nativeNearAssetListed: boolean;
  tokens: FundingToken[];
  chains: { id: string; label: string }[];
};

export type PublicQuote = {
  dry: boolean;
  correlationId: string;
  signature: string;
  originAsset: string;
  destinationAsset: string;
  originSymbol: string;
  destinationSymbol: string;
  originBlockchain: string;
  destinationBlockchain: string;
  originLabel: string;
  destinationLabel: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string | null;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string | null;
  minAmountOut: string;
  minAmountOutFormatted: string | null;
  quotedValueGap: string | null;
  withdrawFee: string | null;
  timeEstimate: number | null;
  deadline: string | null;
  depositAddress: string | null;
  depositMemo: string | null;
  depositType: 'ORIGIN_CHAIN' | 'INTENTS';
  refundTo: string;
  recipient: string;
  contractAddress: string | null;
  stakeableNativeNear: false;
};

export type VerifiedHash = {
  hash: string;
  url: string | null;
  label: string;
};

export type FundingStatus = {
  status: string;
  label: string;
  terminal: boolean;
  updatedAt: string | null;
  depositAddress: string | null;
  amountInFormatted: string | null;
  amountOutFormatted: string | null;
  refundedAmountFormatted: string | null;
  refundReason: string | null;
  hashes: VerifiedHash[];
};

export type FundingActivity = {
  depositAddress: string;
  status: string;
  label: string;
  when: string;
  origin: string;
  destination: string;
  amountIn: string;
  amountOut: string;
  refundReason: string;
  hashes: VerifiedHash[];
};

export type NearDeposit = {
  receiverId: string;
  methodName: 'ft_transfer_call';
  args: { receiver_id: string; amount: string; msg: string };
  gas: string;
  deposit: string;
};

const ACTIVITY_KEY = 'near-easy-funding';

export function chainLabel(id: string): string {
  return CHAIN_LABELS[id] ?? `${id} testnet`;
}

export function supportedChain(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHAIN_LABELS, id);
}

export function isTestnetAssetId(assetId: string): boolean {
  return assetId.startsWith('nep141:') && /\.testnet$/.test(assetId) && !/\.near(?:\.|$)/.test(assetId);
}

export function isNearTestnetAccount(value: string): boolean {
  const account = value.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(account)) return true;
  if (!account.endsWith('.testnet') || account.length < 2 || account.length > 64) return false;
  return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(account);
}

export function isOriginAddress(blockchain: string, value: string): boolean {
  const address = value.trim();
  if (!address || /\s/.test(address)) return false;
  if (blockchain === 'near') return isNearTestnetAccount(address);
  if (blockchain === 'base' || blockchain === 'arb' || blockchain === 'eth') return /^0x[0-9a-fA-F]{40}$/.test(address);
  if (blockchain === 'sol') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (blockchain === 'stellar') return /^G[A-Z2-7]{55}$/.test(address);
  if (blockchain === 'sui') return /^0x[0-9a-fA-F]{64}$/.test(address);
  if (blockchain === 'btc') return /^(tb1[ac-hj-np-z02-9]{8,87}|[mn2][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address);
  if (blockchain === 'xrp') return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
  return false;
}

export function isDepositHash(value: string): boolean {
  const hash = value.trim();
  return /^0x[0-9a-fA-F]{64}$/.test(hash) || /^[1-9A-HJ-NP-Za-km-z]{32,128}$/.test(hash);
}

export function isDepositAddress(value: string): boolean {
  const address = value.trim();
  return address.length >= 8 && address.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(address);
}

export function parseFundingAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(trimmed)) return null;
  if (!Number.isFinite(Number(trimmed)) || Number(trimmed) <= 0) return null;
  return trimmed;
}

export function toBaseUnits(amount: string, decimals: number): string | null {
  const parsed = parseFundingAmount(amount);
  if (!parsed || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const [whole, fraction = ''] = parsed.split('.');
  if (fraction.length > decimals) return null;
  const digits = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+/, '');
  return digits || null;
}

export function formatBaseUnits(amount: string, decimals: number): string | null {
  if (!/^\d+$/.test(amount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  if (decimals === 0) return amount.replace(/^0+/, '') || '0';
  const padded = amount.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals).replace(/^0+/, '') || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function quoteDeadline(blockchain: string, now = Date.now()): string {
  const minutes = blockchain === 'btc' ? 120 : 30;
  return new Date(now + minutes * 60_000).toISOString();
}

export function usdGap(input: string | null, output: string | null): string | null {
  if (!input || !output || !/^\d+(\.\d+)?$/.test(input) || !/^\d+(\.\d+)?$/.test(output)) return null;
  const scale = 10000n;
  const toInt = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * scale + BigInt(fraction.padEnd(4, '0').slice(0, 4));
  };
  const gap = toInt(input) - toInt(output);
  const negative = gap < 0n;
  const absolute = negative ? -gap : gap;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(4, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${fraction ? `${whole.toString()}.${fraction}` : whole.toString()}`;
}

export function trustedExplorer(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (!EXPLORER_HOSTS.has(host)) return null;
  const path = url.pathname.toLowerCase();
  if (host === 'explorer.solana.com' && url.searchParams.get('cluster') !== 'devnet') return null;
  if (host === 'stellar.expert' && !path.includes('/testnet')) return null;
  if ((host === 'mempool.space' || host === 'blockstream.info' || host === 'suiscan.xyz') && !path.includes('testnet')) return null;
  return url.toString();
}

export function normalizeToken(input: unknown): FundingToken | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Partial<FundingToken> & { decimals?: unknown; assetId?: unknown };
  if (typeof row.assetId !== 'string' || !isTestnetAssetId(row.assetId)) return null;
  if (typeof row.blockchain !== 'string' || !supportedChain(row.blockchain)) return null;
  if (typeof row.symbol !== 'string' || !/^[A-Za-z0-9.]{1,12}$/.test(row.symbol)) return null;
  if (typeof row.decimals !== 'number' || !Number.isInteger(row.decimals) || row.decimals < 0 || row.decimals > 36) return null;
  const contract = typeof row.contractAddress === 'string' && row.contractAddress.trim() ? row.contractAddress.trim() : null;
  return {
    assetId: row.assetId,
    blockchain: row.blockchain,
    symbol: row.symbol,
    decimals: row.decimals,
    contractAddress: contract,
  };
}

export function catalogFromTokens(rows: unknown[]): FundingCatalog {
  const tokens = rows.map(normalizeToken).filter((token): token is FundingToken => Boolean(token));
  tokens.sort((a, b) => {
    const chain = CHAIN_ORDER.indexOf(a.blockchain) - CHAIN_ORDER.indexOf(b.blockchain);
    if (chain) return chain;
    return symbolRank(a.symbol) - symbolRank(b.symbol) || a.symbol.localeCompare(b.symbol);
  });
  const seen = new Set<string>();
  const chains = tokens.flatMap((token) => {
    if (seen.has(token.blockchain)) return [];
    seen.add(token.blockchain);
    return [{ id: token.blockchain, label: chainLabel(token.blockchain) }];
  });
  return {
    provider: 'Tidepool',
    affiliate: 'Community-operated. Not affiliated with NEAR.',
    mainnet: false,
    stakeableNativeNear: false,
    nativeNearAssetListed: tokens.some((token) => token.blockchain === 'near' && token.symbol === 'NEAR'),
    tokens,
    chains,
  };
}

function symbolRank(symbol: string): number {
  if (symbol === 'USDC') return 0;
  if (symbol === 'USDT') return 1;
  if (symbol === 'wNEAR') return 2;
  return 3;
}

export function tokensOn(tokens: FundingToken[], blockchain: string): FundingToken[] {
  return tokens.filter((token) => token.blockchain === blockchain);
}

export function findToken(tokens: FundingToken[], assetId: string): FundingToken | null {
  return tokens.find((token) => token.assetId === assetId) ?? null;
}

export function pickToken(tokens: FundingToken[], blockchain: string, symbol: string | null): FundingToken | null {
  const list = tokensOn(tokens, blockchain);
  if (!list.length) return null;
  if (symbol) {
    const match = list.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase());
    if (match) return match;
  }
  return list[0];
}

export function publicQuote(input: {
  body: unknown;
  origin: FundingToken;
  destination: FundingToken;
  dry: boolean;
  refundTo: string;
  recipient: string;
  depositType: 'ORIGIN_CHAIN' | 'INTENTS';
}): PublicQuote | null {
  if (!input.body || typeof input.body !== 'object') return null;
  const body = input.body as { correlationId?: unknown; signature?: unknown; quote?: unknown };
  const quote = body.quote && typeof body.quote === 'object' ? body.quote as Record<string, unknown> : null;
  if (!quote || typeof body.correlationId !== 'string' || typeof body.signature !== 'string') return null;
  if (typeof quote.amountIn !== 'string' || typeof quote.amountOut !== 'string' || typeof quote.amountOutFormatted !== 'string') return null;
  const depositAddress = typeof quote.depositAddress === 'string' ? quote.depositAddress : null;
  if (input.dry && depositAddress) return null;
  if (!input.dry && !depositAddress) return null;
  const amountInUsd = typeof quote.amountInUsd === 'string' ? quote.amountInUsd : null;
  const amountOutUsd = typeof quote.amountOutUsd === 'string' ? quote.amountOutUsd : null;
  const minAmountOut = typeof quote.minAmountOut === 'string' ? quote.minAmountOut : null;
  return {
    dry: input.dry,
    correlationId: body.correlationId,
    signature: body.signature,
    originAsset: input.origin.assetId,
    destinationAsset: input.destination.assetId,
    originSymbol: input.origin.symbol,
    destinationSymbol: input.destination.symbol,
    originBlockchain: input.origin.blockchain,
    destinationBlockchain: input.destination.blockchain,
    originLabel: chainLabel(input.origin.blockchain),
    destinationLabel: chainLabel(input.destination.blockchain),
    amountIn: quote.amountIn,
    amountInFormatted: typeof quote.amountInFormatted === 'string' ? quote.amountInFormatted : formatBaseUnits(quote.amountIn, input.origin.decimals) ?? quote.amountIn,
    amountInUsd,
    amountOut: quote.amountOut,
    amountOutFormatted: quote.amountOutFormatted,
    amountOutUsd,
    minAmountOut: minAmountOut ?? '',
    minAmountOutFormatted: minAmountOut ? formatBaseUnits(minAmountOut, input.destination.decimals) : null,
    quotedValueGap: usdGap(amountInUsd, amountOutUsd),
    withdrawFee: typeof quote.withdrawFee === 'string' ? formatBaseUnits(quote.withdrawFee, input.destination.decimals) : null,
    timeEstimate: typeof quote.timeEstimate === 'number' ? quote.timeEstimate : null,
    deadline: typeof quote.deadline === 'string' ? quote.deadline : null,
    depositAddress,
    depositMemo: typeof quote.depositMemo === 'string' ? quote.depositMemo : null,
    depositType: input.depositType,
    refundTo: input.refundTo,
    recipient: input.recipient,
    contractAddress: input.origin.contractAddress,
    stakeableNativeNear: false,
  };
}

export function nearDepositAction(quote: PublicQuote): NearDeposit | null {
  if (quote.dry || quote.depositType !== 'INTENTS' || quote.originBlockchain !== 'near') return null;
  if (!quote.depositAddress || !quote.contractAddress?.endsWith('.testnet')) return null;
  if (!/^\d+$/.test(quote.amountIn) || !isDepositAddress(quote.depositAddress)) return null;
  return {
    receiverId: quote.contractAddress,
    methodName: 'ft_transfer_call',
    args: {
      receiver_id: VERIFIER_ACCOUNT,
      amount: quote.amountIn,
      msg: quote.depositAddress,
    },
    gas: FUNDING_GAS,
    deposit: '1',
  };
}

export function quotePreviewRows(quote: PublicQuote): { label: string; value: string; hint?: string }[] {
  return [
    { label: 'Source', value: `${quote.originLabel} · ${quote.originSymbol}` },
    { label: 'Amount in', value: `${quote.amountInFormatted} ${quote.originSymbol}`, hint: 'From the Tidepool quote.' },
    { label: 'Expected output', value: `${quote.amountOutFormatted} ${quote.destinationSymbol}`, hint: 'From the Tidepool quote.' },
    { label: 'Minimum output', value: quote.minAmountOutFormatted ? `${quote.minAmountOutFormatted} ${quote.destinationSymbol}` : 'Not in the quote' },
    { label: 'Quoted input value', value: quote.amountInUsd ? `${quote.amountInUsd} USD` : 'Not in the quote' },
    { label: 'Quoted output value', value: quote.amountOutUsd ? `${quote.amountOutUsd} USD` : 'Not in the quote' },
    {
      label: 'Value gap in the quote',
      value: quote.quotedValueGap ? `${quote.quotedValueGap} USD` : 'Not in the quote',
      hint: 'Input value minus output value. This includes the provider fee and any price gap.',
    },
    { label: 'Withdraw fee', value: quote.withdrawFee ? `${quote.withdrawFee} ${quote.destinationSymbol}` : 'Not in the quote' },
    { label: 'NEAR Easy fee', value: 'None. This app does not add a fee.' },
    { label: 'Time estimate', value: quote.timeEstimate == null ? 'Not in the quote' : `${quote.timeEstimate} seconds after the deposit is seen` },
    { label: 'Expiration', value: quote.deadline ?? 'Issued when you prepare the deposit' },
    { label: 'Provider', value: 'Tidepool testnet', hint: 'Community-operated. Not affiliated with NEAR.' },
    { label: 'Network', value: `${quote.originLabel} to ${quote.destinationLabel}` },
    { label: 'Recipient', value: quote.recipient },
  ];
}

export function depositLines(quote: PublicQuote): string[] {
  if (!quote.depositAddress) return [];
  const amount = `${quote.amountInFormatted} ${quote.originSymbol}`;
  const lines = [
    `Send exactly ${amount} on ${quote.originLabel}.`,
    'Real-money networks are disabled. These tokens have no value.',
  ];
  if (quote.depositType === 'INTENTS') {
    lines.push(`A NEAR testnet wallet can approve one token transfer to ${VERIFIER_ACCOUNT}. The message is the deposit address.`);
  } else if (quote.originBlockchain === 'base') {
    lines.push('Connect an EVM wallet in NEAR Easy. It must switch to Base Sepolia, chain id 84532, before you approve this test transfer. Mainnet chain ids are refused.');
    if (quote.contractAddress) lines.push(`Token contract ${quote.contractAddress}. The transfer sends that token to the deposit address.`);
    else lines.push('This is native Base Sepolia ETH. Tidepool caps ETH at 0.006 per swap.');
    lines.push('A hash is checked on Base Sepolia before Tidepool is told about it. That check is not a finished transfer.');
  } else if (quote.originBlockchain === 'arb' || quote.originBlockchain === 'eth') {
    const meta = EVM_CHAINS[quote.originBlockchain];
    lines.push(`Token contract ${quote.contractAddress ?? 'native asset'}.`);
    lines.push(`Network chain id ${meta.chainId}. Approve this in your own testnet wallet. NEAR Easy signs Base Sepolia only.`);
  } else if (quote.originBlockchain === 'sol' && quote.contractAddress) {
    lines.push(`Solana devnet mint ${quote.contractAddress}.`);
    lines.push('Connect Phantom or another Solana wallet in NEAR Easy. It can approve this test transfer. The signed transaction is submitted only to Solana devnet.');
    lines.push('The deposit address owns the token account that receives the tokens. A hash is checked on Solana devnet before Tidepool is told about it.');
  } else if (quote.originBlockchain === 'sol') {
    lines.push('Connect Phantom or another Solana wallet in NEAR Easy and approve a native devnet SOL transfer to the deposit address. Tidepool caps SOL at 0.005 per swap.');
    lines.push('The signed transaction is submitted only to Solana devnet. A hash is checked there before Tidepool is told about it.');
  } else {
    lines.push('Approve the send in your own testnet wallet. NEAR Easy does not hold a key for this chain.');
  }
  if (quote.depositMemo) lines.push(`Memo or destination tag ${quote.depositMemo} is required. A transfer without it cannot be matched.`);
  if (quote.deadline) lines.push(`Tidepool expiration ${quote.deadline}.`);
  return lines;
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING_DEPOSIT':
      return 'Waiting for your deposit';
    case 'KNOWN_DEPOSIT_TX':
      return 'Deposit hash received';
    case 'INCOMPLETE_DEPOSIT':
      return 'Deposit is short';
    case 'PROCESSING':
      return 'Tidepool is settling';
    case 'SUCCESS':
      return 'Tidepool reported SUCCESS';
    case 'REFUNDED':
      return 'Tidepool refunded the deposit';
    case 'FAILED':
      return 'Tidepool reported FAILED';
    default:
      return 'Status was not recognised';
  }
}

export function isTerminalStatus(status: string): boolean {
  return status === 'SUCCESS' || status === 'REFUNDED' || status === 'FAILED';
}

/**
 * Tidepool reported SUCCESS for this Solana devnet deposit on 2026-11-10.
 * Solana finalized a transfer of 2 test USDC (mint 7pafEGXSmR35rLKNaD6inpfLYuEnRX9DyBc1c7M8r4Xr).
 * NEAR finalized an ft_transfer of 1994800 units of usdc.tidepool-sandbox.testnet
 * to roundwheat3869.testnet. The account balance after settlement was 1994800.
 * The asset is Tidepool Testnet USDC. It is not wNEAR and not native NEAR.
 * Mainnet transfers stay off. Another deposit still needs its own SUCCESS.
 */
export const verifiedTestnetFunding: FundingActivity = {
  depositAddress: 'DV54oCBvdWA1FZhdFihJ776uxS2WAtaMQJfz48ckka47',
  status: 'SUCCESS',
  label: statusLabel('SUCCESS'),
  when: '2026-11-10T12:54:18.428Z',
  origin: '2 USDC · Solana devnet',
  destination: '1.9948 USDC to roundwheat3869.testnet',
  amountIn: '2',
  amountOut: '1.9948',
  refundReason: '',
  hashes: [
    {
      hash: '4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK',
      url: 'https://explorer.solana.com/tx/4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK?cluster=devnet',
      label: 'Solana devnet deposit',
    },
    {
      hash: '9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U',
      url: 'https://testnet.nearblocks.io/txns/9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U',
      label: 'NEAR testnet settlement',
    },
  ],
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hashFromExplorer(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const last = parts.at(-1) ?? '';
    return isDepositHash(last) ? last : null;
  } catch {
    return null;
  }
}

export function parseStatusPayload(input: unknown): FundingStatus | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as {
    status?: unknown;
    updatedAt?: unknown;
    quoteResponse?: { quote?: { depositAddress?: unknown } };
    swapDetails?: Record<string, unknown>;
    tidepool?: { explorer?: unknown };
  };
  if (typeof body.status !== 'string' || !STATUSES.has(body.status)) return null;
  const details = body.swapDetails && typeof body.swapDetails === 'object' ? body.swapDetails : {};
  const hashes: VerifiedHash[] = [];
  const seen = new Set<string>();
  const push = (hash: string, url: string | null, label: string) => {
    const key = `${label}:${hash}`;
    if (seen.has(key)) return;
    seen.add(key);
    hashes.push({ hash, url, label: label.slice(0, 80) });
  };
  const linked = (value: unknown, label: string) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { hash?: unknown; explorerUrl?: unknown };
      if (typeof row.hash !== 'string' || !isDepositHash(row.hash)) continue;
      push(row.hash, typeof row.explorerUrl === 'string' ? trustedExplorer(row.explorerUrl) : null, label);
    }
  };
  linked(details.originChainTxHashes, 'Origin chain');
  linked(details.destinationChainTxHashes, 'Destination chain');
  if (Array.isArray(details.nearTxHashes)) {
    for (const hash of details.nearTxHashes) {
      if (typeof hash === 'string' && isDepositHash(hash)) {
        push(hash, trustedExplorer(`https://testnet.nearblocks.io/txns/${hash}`), 'NEAR testnet');
      }
    }
  }
  if (Array.isArray(body.tidepool?.explorer)) {
    for (const item of body.tidepool.explorer) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { url?: unknown; label?: unknown };
      if (typeof row.url !== 'string') continue;
      const url = trustedExplorer(row.url);
      const hash = hashFromExplorer(row.url);
      if (url && hash) push(hash, url, typeof row.label === 'string' ? row.label : 'Tidepool');
    }
  }
  const quoteAddress = body.quoteResponse?.quote?.depositAddress;
  return {
    status: body.status,
    label: statusLabel(body.status),
    terminal: isTerminalStatus(body.status),
    updatedAt: text(body.updatedAt),
    depositAddress: typeof quoteAddress === 'string' ? quoteAddress : null,
    amountInFormatted: text(details.amountInFormatted) ?? text(details.depositedAmountFormatted),
    amountOutFormatted: text(details.amountOutFormatted),
    refundedAmountFormatted: text(details.refundedAmountFormatted),
    refundReason: text(details.refundReason),
    hashes,
  };
}

export function readFundingActivity(): FundingActivity[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<FundingActivity>;
      if (typeof row.depositAddress !== 'string' || !isDepositAddress(row.depositAddress)) return [];
      if (typeof row.status !== 'string' || !STATUSES.has(row.status)) return [];
      if (typeof row.when !== 'string' || typeof row.origin !== 'string' || typeof row.destination !== 'string') return [];
      const hashes = Array.isArray(row.hashes)
        ? row.hashes.flatMap((hash) => {
            if (!hash || typeof hash !== 'object') return [];
            const entry = hash as Partial<VerifiedHash>;
            if (typeof entry.hash !== 'string' || !isDepositHash(entry.hash) || typeof entry.label !== 'string') return [];
            return [{
              hash: entry.hash,
              label: entry.label.slice(0, 80),
              url: typeof entry.url === 'string' ? trustedExplorer(entry.url) : null,
            }];
          })
        : [];
      return [{
        depositAddress: row.depositAddress,
        status: row.status,
        label: statusLabel(row.status),
        when: row.when,
        origin: row.origin,
        destination: row.destination,
        amountIn: typeof row.amountIn === 'string' ? row.amountIn : 'Not in the status',
        amountOut: typeof row.amountOut === 'string' ? row.amountOut : 'Not in the status',
        refundReason: typeof row.refundReason === 'string' ? row.refundReason : '',
        hashes,
      }];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

export function saveFundingActivity(entry: FundingActivity) {
  try {
    const next = [entry, ...readFundingActivity().filter((item) => item.depositAddress !== entry.depositAddress)].slice(0, 20);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    /* The Tidepool status still stands if this browser cannot store the row. */
  }
}
