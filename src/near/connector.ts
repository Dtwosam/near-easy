import { NearConnector } from '@hot-labs/near-connect';
import type { NetworkId } from './chain';

let connector: NearConnector | null = null;

/**
 * One HOT connector for the page.
 * Sign-in does not add a function-call key and does not receive a seed phrase.
 * WalletConnect is omitted because this app has no Reown project id.
 * autoConnect stays off so a wallet opens only after a click. Returning visits
 * are restored with getConnectedWallet(), which reads accounts and does not sign.
 */
export function getConnector(network: NetworkId): NearConnector {
  if (!connector) {
    connector = new NearConnector({
      network,
      autoConnect: false,
      providers: {
        mainnet: ['https://rpc.mainnet.fastnear.com', 'https://rpc.mainnet.near.org'],
        testnet: ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org'],
      },
    });
  }
  connector.network = network;
  return connector;
}

export function clearSelectedWallet() {
  try {
    localStorage.removeItem('selected-wallet');
  } catch {
    /* Storage can be blocked. The in-memory session is still cleared. */
  }
}
