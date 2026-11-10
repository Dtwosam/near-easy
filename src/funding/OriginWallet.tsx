import { useEffect, useState } from 'react';
import { connectEvmWallet, disconnectEvmWallet, discoverEvmWallets } from './evmWallet';
import { explainOriginError } from './originPlan';
import { connectSolanaWallet, disconnectSolanaWallet, discoverSolanaWallets } from './solanaWallet';
import { Button } from '../ui';

export function OriginWallet({
  chain,
  account,
  walletId,
  disabled,
  compact = false,
  onAccount,
  onClear,
}: {
  chain: 'sol' | 'base';
  account: string;
  walletId: string;
  disabled: boolean;
  compact?: boolean;
  onAccount: (walletId: string, address: string) => void;
  onClear: () => void;
}) {
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([]);
  const [looking, setLooking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const solana = chain === 'sol';

  useEffect(() => {
    let stop = false;
    setLooking(true);
    const pending = solana ? discoverSolanaWallets() : discoverEvmWallets();
    void pending.then((next) => {
      if (stop) return;
      setChoices(next);
      setLooking(false);
    }).catch(() => {
      if (!stop) setLooking(false);
    });
    return () => {
      stop = true;
    };
  }, [solana]);

  async function connect(id: string) {
    setConnecting(true);
    setError('');
    try {
      const address = solana ? await connectSolanaWallet(id) : await connectEvmWallet(id);
      onAccount(id, address);
    } catch (reason) {
      setError(explainOriginError(reason));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setError('');
    try {
      if (solana) await disconnectSolanaWallet(walletId);
      else disconnectEvmWallet(walletId);
    } catch {
      /* The address is still cleared if the wallet does not answer. */
    }
    onClear();
  }

  const walletHelp = solana
    ? 'Connect Phantom or another compatible wallet. NEAR Easy asks it to approve the test transfer, then submits that transaction only to Solana devnet. It does not ask for a seed phrase. Mainnet is refused. A token transfer also needs a little devnet SOL for the fee. The faucet does not drip SOL.'
    : 'Connect an EVM wallet. NEAR Easy switches it to Base Sepolia, chain id 84532, and asks you to approve the test transfer. Mainnet chains are refused. It does not ask for a seed phrase. The transfer needs a little Base Sepolia ETH for gas. The faucet does not drip ETH.';
  const missingWallet = solana
    ? 'No Solana wallet was found in this browser. Install Phantom or another Wallet Standard wallet, then refresh this page. You can still prepare a deposit and paste a Solana devnet hash.'
    : 'No EVM wallet was found in this browser. Install a wallet that supports Base Sepolia, then refresh this page. You can still prepare a deposit and paste a Base Sepolia hash.';

  return (
    <div className="origin-wallet" id="origin-wallet">
      <h2>{solana ? 'Solana devnet wallet' : 'Base Sepolia wallet'}</h2>
      {compact ? (
        <details className="help">
          <summary>About this wallet</summary>
          <div className="help-body">
            <p>{walletHelp}</p>
          </div>
        </details>
      ) : (
        <p className="hint">{walletHelp}</p>
      )}
      {account ? (
        <>
          <p className="hint">Connected {account}</p>
          <Button disabled={disabled || connecting} onClick={() => void disconnect()}>Disconnect</Button>
        </>
      ) : looking ? (
        <p className="loading-line" role="status">Looking for a wallet…</p>
      ) : choices.length ? (
        <div className="inline-actions">
          {choices.map((choice) => (
            <Button key={choice.id} disabled={disabled || connecting} onClick={() => void connect(choice.id)}>Connect {choice.name}</Button>
          ))}
        </div>
      ) : compact ? (
        <>
          <p className="hint">{solana ? 'No Solana wallet was found in this browser.' : 'No EVM wallet was found in this browser.'}</p>
          <details className="help">
            <summary>Wallet help</summary>
            <div className="help-body">
              <p>{missingWallet}</p>
            </div>
          </details>
        </>
      ) : (
        <p className="hint">{missingWallet}</p>
      )}
      {error ? <p className="warn-box" role="alert">{error}</p> : null}
    </div>
  );
}
