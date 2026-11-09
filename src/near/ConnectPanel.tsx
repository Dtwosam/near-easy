import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Button, CopyButton } from '../ui';
import { shortAccount } from './format';

export function ConnectPanel() {
  const store = useStore();
  const connected = store.walletPhase === 'connected' && Boolean(store.accountId);

  return (
    <>
      <div className="mode-switch" role="radiogroup" aria-label="NEAR network">
        <button type="button" role="radio" aria-checked={store.network === 'mainnet'} className={store.network === 'mainnet' ? 'on' : ''} onClick={() => store.setNetwork('mainnet')}>
          Mainnet
        </button>
        <button type="button" role="radio" aria-checked={store.network === 'testnet'} className={store.network === 'testnet' ? 'on' : ''} onClick={() => store.setNetwork('testnet')}>
          Testnet
        </button>
      </div>
      <p className="hint">Mainnet is where real balances are. Some wallets in this list do not offer testnet.</p>

      {connected && store.accountId ? (
        <>
          <p>
            Signed in as <strong>{store.walletName}</strong> on {store.network}.
          </p>
          <p className="mono" title={store.accountId}>
            {store.accountId}
          </p>
          <CopyButton value={store.accountId} label="Copy account" />
          {store.accounts.length > 1 ? (
            <div className="choices" role="group" aria-label="Accounts in this wallet">
              {store.accounts.map((id) => (
                <button key={id} type="button" className={id === store.accountId ? 'choice on' : 'choice'} onClick={() => store.selectAccount(id)}>
                  {shortAccount(id)}
                </button>
              ))}
            </div>
          ) : null}
          {store.balance.loading ? <p className="hint">Reading NEAR balances…</p> : null}
          {store.balance.error ? (
            <p className="field-error" role="alert">
              {store.balance.error}
            </p>
          ) : null}
          <div className="modal-actions">
            <Button onClick={store.refreshHoldings} disabled={store.balance.loading}>
              Refresh balance
            </Button>
            <Button onClick={store.switchWallet}>Switch wallet</Button>
            <Button variant="primary" onClick={store.disconnectWallet}>
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>Choose a NEAR wallet. Nothing is connected until you approve it in that wallet.</p>
          <p>NEAR Easy will not ask for your seed phrase or private key.</p>
          {store.walletPhase === 'connecting' ? <p role="status">Waiting for your wallet…</p> : null}
          {store.walletError ? (
            <p className="field-error" role="alert">
              {store.walletError}
            </p>
          ) : null}
          <div className="modal-actions">
            {store.walletPhase === 'connecting' ? (
              <Button onClick={store.stopWaiting}>Stop waiting</Button>
            ) : (
              <Button id="choose-wallet" variant="primary" onClick={store.connectWallet}>
                Choose a wallet
              </Button>
            )}
            <Link to="/explore?category=Wallets" className="btn btn-secondary" onClick={store.closeConnect}>
              See wallet apps
            </Link>
          </div>
        </>
      )}
    </>
  );
}
