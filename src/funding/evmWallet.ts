import { isOriginAddress } from './plan';
import { evmTransferCall, isBaseSepolia } from './originPlan';
import type { TransferSource } from './originPlan';

export const BASE_SEPOLIA_PARAMS = {
  chainId: '0x14a34',
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: Eip1193[];
};

type EvmSession = {
  address: string;
  provider: Eip1193;
};

type Announced = {
  info?: { uuid?: string; name?: string };
  provider?: Eip1193;
};

const sessions = new Map<string, EvmSession>();
let listed: { id: string; name: string; provider: Eip1193 }[] = [];

function providerName(provider: Eip1193): string {
  if (provider.isRabby) return 'Rabby';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isMetaMask) return 'MetaMask';
  return 'Browser wallet';
}

function browserProviders(): { id: string; name: string; provider: Eip1193 }[] {
  const ethereum = (window as Window & { ethereum?: Eip1193 }).ethereum;
  if (!ethereum?.request) return [];
  const list = Array.isArray(ethereum.providers) && ethereum.providers.length ? ethereum.providers : [ethereum];
  return list.filter((provider) => typeof provider?.request === 'function').map((provider, index) => ({
    id: `injected:${index}:${providerName(provider)}`,
    name: providerName(provider),
    provider,
  }));
}

export function discoverEvmWallets(): Promise<{ id: string; name: string }[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);
  return new Promise((resolve) => {
    const found = new Map<string, { id: string; name: string; provider: Eip1193 }>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Announced>).detail;
      if (!detail?.info?.uuid || !detail.info.name || typeof detail.provider?.request !== 'function') return;
      found.set(detail.info.uuid, { id: detail.info.uuid, name: detail.info.name, provider: detail.provider });
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      listed = found.size ? [...found.values()] : browserProviders();
      resolve(listed.map((wallet) => ({ id: wallet.id, name: wallet.name })));
    }, 250);
  });
}

async function ensureBaseSepolia(provider: Eip1193) {
  const current = await provider.request({ method: 'eth_chainId' });
  if (isBaseSepolia(current)) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_PARAMS.chainId }] });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? Number((error as { code: unknown }).code) : 0;
    if (code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [BASE_SEPOLIA_PARAMS] });
  }
  const after = await provider.request({ method: 'eth_chainId' });
  if (!isBaseSepolia(after)) throw new Error('The wallet is not on Base Sepolia. Nothing was sent.');
}

export async function connectEvmWallet(id: string): Promise<string> {
  const wallet = listed.find((item) => item.id === id);
  if (!wallet) throw new Error('That EVM wallet is no longer available.');
  const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
  const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
  if (!isOriginAddress('base', address)) throw new Error('The EVM wallet did not return an address.');
  sessions.set(id, { address, provider: wallet.provider });
  return address;
}

export function disconnectEvmWallet(id: string) {
  sessions.delete(id);
}

export async function sendBaseTransfer(provider: Eip1193, from: string, quote: TransferSource): Promise<string> {
  const call = evmTransferCall(quote);
  if (!call || call.chainId !== 84532) throw new Error('This quote cannot be sent on Base Sepolia.');
  await ensureBaseSepolia(provider);
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (!isBaseSepolia(chainId)) throw new Error('The wallet is not on Base Sepolia. Nothing was sent.');
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: call.to, data: call.data, value: call.value }],
  });
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('The wallet returned no transaction hash.');
  }
  return hash;
}

export async function approveBaseDeposit(id: string, quote: TransferSource & { owner: string }): Promise<string> {
  const session = sessions.get(id);
  if (!session || session.address.toLowerCase() !== quote.owner.toLowerCase()) throw new Error('No EVM wallet is connected.');
  return sendBaseTransfer(session.provider, session.address, quote);
}
