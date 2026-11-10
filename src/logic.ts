import { isNearTestnetAccount } from './funding/plan';

export type Intent =
  | 'fund-stake'
  | 'start'
  | 'wallet'
  | 'discover'
  | 'stake'
  | 'fund'
  | 'execute-blocked'
  | 'unknown';

export type Mode = 'simple' | 'advanced';

export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function normalizeAccount(value: string): string {
  return value.trim().toLowerCase();
}

export function isNearAccount(value: string): boolean {
  const account = normalizeAccount(value);
  if (/^[0-9a-f]{64}$/.test(account)) return true;
  if (account.length < 2 || account.length > 64) return false;
  return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(account);
}

export function matchIntent(raw: string): Intent {
  const text = raw.toLowerCase();
  if (
    /(sign|broadcast|execute).{0,40}(transaction|tx)/.test(text) ||
    /send (the |this )?(transaction|tx)/.test(text) ||
    /do it now|stake it now|confirm and (send|stake)/.test(text)
  ) {
    return 'execute-blocked';
  }
  if (/\b(un)?stak\w*/.test(text) && /(\bsolana\b|\bethereum\b|\bbase\b|\barbitrum\b|\busdc\b|\busdt\b|\$\s?\d|\bfrom\b)/.test(text)) {
    return 'fund-stake';
  }
  if (/get started|new to near|never used near|help me get started|i'm new|im new/.test(text)) {
    return 'start';
  }
  if (/what can i do|what i can do|show me what|explore near/.test(text)) return 'discover';
  // A transfer can name the source wallet, so this comes before a wallet question.
  const cross = /\b(solana|base|arbitrum|ethereum|stellar|sui|bitcoin|xrp|usdc|usdt)\b/.test(text);
  const verb = /\b(fund|bridge|cross-chain|cross chain|move|transfer|send)\b/.test(text)
    || /\b(?:from|using|via|out\s+of)\s+(?:my\s+|the\s+|a\s+|an\s+)?(?:solana|base|arbitrum|ethereum|stellar|sui|bitcoin|btc|xrp)\b/.test(text);
  if (cross && verb) return 'fund';
  if (/wallet|balance|my near/.test(text)) return 'wallet';
  if (/\b(un)?stak\w*|\bvalidator|\bdelegat/.test(text)) return 'stake';
  return 'unknown';
}

export function parseStakeAsk(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bunstak/.test(lower)) return null;
  const named = lower.match(/(\d{1,12}(?:\.\d{1,6})?)\s*near\b/);
  const plain = lower.match(/\bstake\s+(\d{1,12}(?:\.\d{1,6})?)\b/);
  const raw = named?.[1] ?? plain?.[1] ?? null;
  if (!raw || !parseAmount(raw)) return null;
  return raw;
}

export function parseFundingRecipient(text: string): string | null {
  const found = text.match(/\b([a-z\d](?:[a-z\d_-]{0,58})?\.testnet|[0-9a-f]{64})\b/i);
  if (!found) return null;
  const account = found[1].toLowerCase();
  return isNearTestnetAccount(account) ? account : null;
}

const VALIDATOR_SKIP = new Set(['near', 'testnet', 'mainnet', 'the', 'a', 'an', 'my', 'wallet', 'me', 'this', 'account']);

/** A pool name or pool account from the request. An amount alone is not a validator. */
export function parseValidatorAsk(text: string): string | null {
  const explicit = text.match(/\b(?:with|using|via|through|validator|pool)\s+([a-z\d][a-z\d._-]{0,63})/i);
  if (explicit) {
    const word = explicit[1].replace(/[.,;:]+$/, '').toLowerCase();
    if (word && !VALIDATOR_SKIP.has(word)) return word;
  }
  const id = text.match(/\b([a-z\d](?:[a-z\d_-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d_-]*[a-z\d])?){1,5})\b/i);
  if (id && /pool/i.test(id[1])) return id[1].toLowerCase();
  return null;
}

function fundingAmount(raw: string | undefined): string | null {
  if (!raw || !/^\d{1,12}(\.\d{1,12})?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return raw;
}

export function parseFundingAsk(text: string): {
  amount: string;
  chain: string;
  token: string;
  tokenWasNamed: boolean;
  chainWasNamed: boolean;
  amountWasNamed: boolean;
} {
  const lower = text.toLowerCase();
  const dollar = fundingAmount(lower.match(/\$\s*(\d{1,12}(?:\.\d{1,12})?)/)?.[1]);
  const besideToken = fundingAmount(lower.match(/(\d{1,12}(?:\.\d{1,12})?)\s*(?:test\s+)?(?:usdc|usdt|sol|eth|xlm|sui|xrp|btc|near)\b/)?.[1]);
  const verbAmount = fundingAmount(lower.match(/\b(?:move|send|transfer|bridge|fund|use)\s+(\d{1,12}(?:\.\d{1,12})?)\b/)?.[1]);
  const amount = dollar ?? besideToken ?? verbAmount ?? '100';
  const from = lower.match(/\b(?:from|using|via|out\s+of)\s+(?:my\s+|the\s+|a\s+|an\s+)?(solana|ethereum|arbitrum|base|stellar|sui|bitcoin|btc|xrp|near)(?:\s+wallet)?\b/);
  const chainWords: [RegExp, string][] = [
    [/\bbase\b/, 'base'],
    [/arbitrum/, 'arb'],
    [/ethereum/, 'eth'],
    [/stellar/, 'stellar'],
    [/\bsui\b/, 'sui'],
    [/bitcoin|\bbtc\b/, 'btc'],
    [/\bxrp\b/, 'xrp'],
    [/solana/, 'sol'],
  ];
  const fromChain: Record<string, string> = {
    solana: 'sol',
    ethereum: 'eth',
    arbitrum: 'arb',
    base: 'base',
    stellar: 'stellar',
    sui: 'sui',
    bitcoin: 'btc',
    btc: 'btc',
    xrp: 'xrp',
    near: 'near',
  };
  let chain = 'sol';
  let chainWasNamed = false;
  if (from) {
    chain = fromChain[from[1]] ?? 'sol';
    chainWasNamed = true;
  } else {
    for (const [pattern, code] of chainWords) {
      if (pattern.test(lower)) {
        chain = code;
        chainWasNamed = true;
        break;
      }
    }
  }
  let token = 'USDC';
  let tokenWasNamed = false;
  if (/usdt/.test(lower)) {
    token = 'USDT';
    tokenWasNamed = true;
  } else if (/usdc/.test(lower)) {
    token = 'USDC';
    tokenWasNamed = true;
  } else if (/\bsol\b/.test(lower) && chain === 'sol') {
    token = 'SOL';
    tokenWasNamed = true;
  } else if (/\beth\b/.test(lower) && chain !== 'sol') {
    token = 'ETH';
    tokenWasNamed = true;
  } else if (/\bxrp\b/.test(lower) && chain === 'xrp') {
    token = 'XRP';
    tokenWasNamed = true;
  } else if (/\bbtc\b|bitcoin/.test(lower) && chain === 'btc') {
    token = 'BTC';
    tokenWasNamed = true;
  }
  return { amount, chain, token, tokenWasNamed, chainWasNamed, amountWasNamed: Boolean(dollar ?? besideToken ?? verbAmount) };
}
