import { useState } from 'react';
import { useStore } from '../store';
import { Capability, useTitle } from '../ui';

export function SettingsPage() {
  useTitle('Settings');
  const store = useStore();
  const [themeNote, setThemeNote] = useState('');

  return (
    <div className="page settings-page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="lede">Preferences stay on this device. They do not change a wallet.</p>
          <Capability ready="Mode and notification choices are saved" chain={store.accountId ? 'Alerts are not sent' : 'No alert service'} />
        </div>
      </div>

      <section className="card" id="mode">
        <h2>Explanation mode</h2>
        <p>Simple keeps answers short. Advanced adds account and fee detail.</p>
        <div className="mode-switch" role="radiogroup" aria-label="Explanation mode">
          <button type="button" role="radio" aria-checked={store.mode === 'simple'} className={store.mode === 'simple' ? 'on' : ''} onClick={() => store.setMode('simple')}>
            Simple
          </button>
          <button type="button" role="radio" aria-checked={store.mode === 'advanced'} className={store.mode === 'advanced' ? 'on' : ''} onClick={() => store.setMode('advanced')}>
            Advanced
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Connected wallets</h2>
        {store.accountId ? (
          <>
            <p>{store.walletName} is signed in on {store.network}. Send does not broadcast. Mainnet staking stays off.</p>
            <p className="mono">{store.accountId}</p>
          </>
        ) : (
          <p>No wallet is signed in. Choosing a wallet opens the NEAR wallet list. Approval happens in that wallet.</p>
        )}
        {store.walletError ? <p className="field-error">{store.walletError}</p> : null}
        <button type="button" className="btn btn-secondary" onClick={store.accountId ? store.openConnect : store.connectWallet}>
          {store.accountId ? 'Manage wallet' : 'Connect a wallet'}
        </button>
      </section>

      <section className="card" id="theme">
        <h2>Theme</h2>
        <div className="choices">
          <button type="button" className="choice on" aria-pressed="true">
            Premium dark
          </button>
          <button type="button" className="choice" onClick={() => setThemeNote('System theme is coming soon. Premium dark stays on.')}>
            System · Coming soon
          </button>
          <button type="button" className="choice" onClick={() => setThemeNote('Light theme is coming soon. Premium dark stays on.')}>
            Light · Coming soon
          </button>
        </div>
        <p className="hint">Premium dark is the current theme. Other themes are not available, so they do not change the interface.</p>
        {themeNote ? <p role="status">{themeNote}</p> : null}
      </section>

      <section className="card" id="notifications">
        <h2>Notifications</h2>
        <div className="setting-row">
          <div>
            <strong>Product notes</strong>
            <p>Saved on this device. There is no email or push service.</p>
          </div>
          <button type="button" role="switch" className="switch" aria-checked={store.notes.product} onClick={() => store.setNotes({ ...store.notes, product: !store.notes.product })}>
            <i />
            <span className="sr-only">Product notes</span>
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Activity alerts</strong>
            <p>Your preference is saved. Alerts cannot arrive until real transactions exist.</p>
          </div>
          <button type="button" role="switch" className="switch" aria-checked={store.notes.activity} onClick={() => store.setNotes({ ...store.notes, activity: !store.notes.activity })}>
            <i />
            <span className="sr-only">Activity alerts</span>
          </button>
        </div>
        {store.savedNote ? <p role="status">{store.savedNote}</p> : null}
      </section>

      <section className="card" id="security">
        <h2>Security</h2>
        <ul className="plain-steps">
          <li>NEAR Easy will not ask for your seed phrase or private key.</li>
          <li>A real transaction must be approved in your wallet.</li>
          <li>This app does not hold a key. A testnet stake or deposit opens your wallet for approval.</li>
          <li>Funding uses Tidepool, a community testnet that is not affiliated with NEAR. Real-money transfers stay off. Test wNEAR is not native NEAR and is not staked here.</li>
          <li>Phantom can approve Solana devnet. An EVM wallet can approve Base Sepolia, chain id 84532. Mainnet is refused.</li>
          <li>Check the site address before you approve a connection in your wallet.</li>
          <li>Sample addresses are examples. Do not send funds to them. A public demo still uses testnet tokens only.</li>
        </ul>
      </section>

      <section className="card" id="help">
        <h2>Help and support</h2>
        <p>NEAR Easy does not custody funds and does not offer wallet recovery. For a wallet problem, use the support channel of the wallet you chose.</p>
        <div className="link-list">
          <a href="https://near.org/" target="_blank" rel="noreferrer">NEAR</a>
          <a href="https://docs.near.org/" target="_blank" rel="noreferrer">NEAR Docs</a>
          <a href="https://docs.near.org/protocol/network/validators" target="_blank" rel="noreferrer">Staking docs</a>
          <a href="https://wallet.near.org/" target="_blank" rel="noreferrer">Wallet directory</a>
          <button type="button" onClick={store.openGlossary}>Open the glossary</button>
        </div>
      </section>
    </div>
  );
}
