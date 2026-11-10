import { isOriginAddress } from './plan';
import { SOLANA_DEVNET_CHAIN } from './originPlan';

/** Phantom's current account list uses this alias as well as the CAIP-2 devnet id. */
const SOLANA_DEVNET_ALIAS = 'solana:devnet';

export function solanaDevnetChain(chains: readonly string[] | undefined): string | null {
  const listed = chains ?? [];
  if (listed.includes(SOLANA_DEVNET_CHAIN)) return SOLANA_DEVNET_CHAIN;
  if (listed.includes(SOLANA_DEVNET_ALIAS)) return SOLANA_DEVNET_ALIAS;
  return null;
}

export function walletStandardSignInput(account: StandardAccount, transaction: Uint8Array): {
  account: StandardAccount;
  transaction: Uint8Array;
  chain: string;
} {
  const chain = solanaDevnetChain(account.chains);
  if (!chain) throw new Error('The wallet is not on Solana devnet.');
  return { account, transaction, chain };
}

export function signedTransactionBytes(outputs: unknown): Uint8Array | null {
  const row = Array.isArray(outputs) ? outputs[0] : outputs;
  if (!row || typeof row !== 'object') return null;
  const signed = (row as { signedTransaction?: unknown }).signedTransaction;
  if (signed instanceof Uint8Array) return new Uint8Array(signed);
  if (signed instanceof ArrayBuffer) return new Uint8Array(signed);
  if (ArrayBuffer.isView(signed)) {
    const view = signed as ArrayBufferView;
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  return null;
}

export async function requestStandardSignature(
  signTransaction: (input: { account: StandardAccount; transaction: Uint8Array; chain: string }) => Promise<unknown>,
  account: StandardAccount,
  transaction: Uint8Array,
): Promise<Uint8Array> {
  const bytes = Uint8Array.from(transaction);
  const outputs = await signTransaction(walletStandardSignInput(account, bytes));
  const signed = signedTransactionBytes(outputs);
  if (!signed) throw new Error('The wallet did not return a signed transaction.');
  return signed;
}

type StandardAccount = {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
};

type StandardWallet = {
  name: string;
  chains: readonly string[];
  features: Record<string, unknown>;
  accounts: readonly StandardAccount[];
};

type Signable = {
  serialize(options?: { requireAllSignatures?: boolean; verifySignatures?: boolean }): Uint8Array;
};

type SolanaSession = {
  address: string;
  disconnect: () => Promise<void>;
  sign: (transaction: Signable) => Promise<Uint8Array>;
};

type ListedWallet = {
  id: string;
  name: string;
  connect: () => Promise<SolanaSession>;
};

type LegacyProvider = {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signTransaction?: (transaction: Signable) => Promise<Signable>;
  disconnect?: () => Promise<void>;
};

const registry = new Set<StandardWallet>();
const sessions = new Map<string, SolanaSession>();
let listed: ListedWallet[] = [];
let listening = false;

function walletWindow(): Window & {
  phantom?: { solana?: LegacyProvider };
  solana?: LegacyProvider;
} {
  return window as Window & { phantom?: { solana?: LegacyProvider }; solana?: LegacyProvider };
}

function ensureListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const api = {
    register(wallet: StandardWallet) {
      if (wallet && typeof wallet.name === 'string') registry.add(wallet);
      return () => {
        registry.delete(wallet);
      };
    },
  };
  window.addEventListener('wallet-standard:register-wallet', (event) => {
    const callback = (event as CustomEvent<(value: typeof api) => void>).detail;
    if (typeof callback === 'function') callback(api);
  });
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
}

function canSignDevnet(wallet: StandardWallet): boolean {
  const feature = wallet.features?.['solana:signTransaction'] as { signTransaction?: unknown } | undefined;
  const solana = (wallet.chains ?? []).some((chain) => chain === SOLANA_DEVNET_CHAIN || chain.startsWith('solana:'));
  return solana && typeof feature?.signTransaction === 'function';
}

function legacyProviders(): { name: string; provider: LegacyProvider }[] {
  if (typeof window === 'undefined') return [];
  const root = walletWindow();
  const pairs = [
    { name: 'Phantom', provider: root.phantom?.solana },
    { name: root.solana?.isPhantom ? 'Phantom' : 'Solana wallet', provider: root.solana },
  ];
  const seen = new Set<LegacyProvider>();
  return pairs.flatMap((item) => {
    if (!item.provider || seen.has(item.provider) || typeof item.provider.signTransaction !== 'function') return [];
    seen.add(item.provider);
    return [{ name: item.name, provider: item.provider }];
  });
}

function collect(): ListedWallet[] {
  const wallets: ListedWallet[] = [];
  const names = new Set<string>();
  let index = 0;
  for (const wallet of registry) {
    if (!canSignDevnet(wallet)) continue;
    const id = `standard:${wallet.name}:${index}`;
    index += 1;
    names.add(wallet.name.toLowerCase());
    wallets.push({
      id,
      name: wallet.name,
      async connect() {
        const connect = wallet.features['standard:connect'] as {
          connect?: (input?: { silent?: boolean }) => Promise<{ accounts: StandardAccount[] }>;
        } | undefined;
        const sign = wallet.features['solana:signTransaction'] as {
          signTransaction?: (input: { account: StandardAccount; transaction: Uint8Array; chain?: string }) => Promise<unknown>;
        } | undefined;
        if (!connect?.connect || !sign?.signTransaction) throw new Error('This Solana wallet cannot sign a devnet transaction.');
        const result = await connect.connect();
        const accounts = result.accounts?.length ? result.accounts : wallet.accounts;
        const account = accounts.find((item) => solanaDevnetChain(item.chains))
          ?? accounts.find((item) => item.chains?.some((chain) => chain.startsWith('solana:')))
          ?? accounts[0];
        if (!account?.address || !isOriginAddress('sol', account.address)) {
          throw new Error('The Solana wallet did not return an address.');
        }
        const disconnectFeature = wallet.features['standard:disconnect'] as { disconnect?: () => Promise<void> } | undefined;
        return {
          address: account.address,
          async disconnect() {
            await disconnectFeature?.disconnect?.();
          },
          async sign(transaction) {
            // One object, not an array. signTransaction is a rest-parameter method.
            // The wallet only signs. Submission stays on Solana devnet.
            if (!sign.signTransaction) throw new Error('This Solana wallet cannot sign a devnet transaction.');
            const bytes = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
            return requestStandardSignature(sign.signTransaction, account, bytes);
          },
        };
      },
    });
  }
  for (const item of legacyProviders()) {
    if (names.has(item.name.toLowerCase())) continue;
    const id = `legacy:${item.name}:${index}`;
    index += 1;
    wallets.push({
      id,
      name: item.name,
      async connect() {
        const response = await item.provider.connect();
        const address = response.publicKey?.toString?.() ?? '';
        if (!isOriginAddress('sol', address)) throw new Error('The Solana wallet did not return an address.');
        return {
          address,
          async disconnect() {
            await item.provider.disconnect?.();
          },
          async sign(transaction) {
            if (!item.provider.signTransaction) throw new Error('This Solana wallet cannot sign a devnet transaction.');
            const signed = await item.provider.signTransaction(transaction);
            return signed.serialize();
          },
        };
      },
    });
  }
  return wallets;
}

export async function discoverSolanaWallets(): Promise<{ id: string; name: string }[]> {
  ensureListening();
  await new Promise((resolve) => window.setTimeout(resolve, 50));
  listed = collect();
  return listed.map((wallet) => ({ id: wallet.id, name: wallet.name }));
}

export async function connectSolanaWallet(id: string): Promise<string> {
  const wallet = listed.find((item) => item.id === id);
  if (!wallet) throw new Error('That Solana wallet is no longer available.');
  const session = await wallet.connect();
  sessions.set(id, session);
  return session.address;
}

export async function disconnectSolanaWallet(id: string) {
  const session = sessions.get(id);
  sessions.delete(id);
  await session?.disconnect();
}

export async function approveSolanaDeposit(id: string, input: {
  owner: string;
  depositAddress: string;
  amount: string;
  mint: string | null;
  decimals: number;
}): Promise<string> {
  const session = sessions.get(id);
  if (!session || session.address !== input.owner) throw new Error('No Solana wallet is connected.');
  const transfer = await import('./solanaTransfer');
  const { findConfirmedSolanaDeposit } = await import('./originRpc');
  try {
    const existing = await findConfirmedSolanaDeposit(input);
    if (existing) return existing;
  } catch {
    // A failed lookup is not a broadcast. Signing can still proceed.
  }
  const recentBlockhash = await transfer.recentDevnetBlockhash();
  const transaction = transfer.buildSolanaDepositTransaction({ ...input, recentBlockhash });
  if (!transaction) throw new Error('This quote cannot be sent on Solana devnet.');
  const raw = await session.sign(transaction);
  return transfer.sendSignedSolanaTransaction(raw);
}
