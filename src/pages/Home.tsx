import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { features, homeTiles, statusLabel, suggestions } from '../data';
import { readFundingActivity } from '../funding/plan';
import { HeroArt, Icon, LogoMark } from '../icons';
import type { IconName } from '../icons';
import { readStakeActivity } from '../near/stakePlan';
import { useStore } from '../store';
import { ActionCard, Badge, Capability, useTitle } from '../ui';

type RecentRow = {
  id: string;
  title: string;
  detail: string;
  amount: string;
  badge: string;
  tone: 'accent' | 'danger' | 'warn';
  when: string;
  icon: IconName;
};

function recentRows(): RecentRow[] {
  const funding = readFundingActivity().map((item) => ({
    id: item.depositAddress,
    title: 'Funding',
    detail: item.label,
    amount: item.amountIn,
    badge: item.status === 'SUCCESS' ? 'Tidepool SUCCESS' : item.label,
    tone: item.status === 'SUCCESS' ? 'accent' as const : item.status === 'FAILED' || item.status === 'REFUNDED' ? 'danger' as const : 'warn' as const,
    when: item.when,
    icon: 'arrows' as const,
  }));
  const stakes = readStakeActivity().map((item) => ({
    id: item.hash,
    title: 'Stake',
    detail: `${item.amount} NEAR · ${item.network}`,
    amount: `${item.amount} NEAR`,
    badge: 'NEAR confirmed',
    tone: 'accent' as const,
    when: item.when,
    icon: 'layers' as const,
  }));
  return [...funding, ...stakes].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 2);
}

export function HomePage() {
  useTitle('NEAR Easy');
  const navigate = useNavigate();
  const store = useStore();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function go(value: string) {
    const clean = value.trim();
    if (!clean) {
      setError('Tell us what you want to do.');
      return;
    }
    navigate('/assistant', { state: { text: clean, nonce: crypto.randomUUID() } });
  }

  const counts = {
    all: features.length,
    available: features.filter((feature) => feature.status === 'available').length,
    building: features.filter((feature) => feature.status === 'building').length,
    soon: features.filter((feature) => feature.status === 'soon').length,
  };
  const rows = recentRows();

  return (
    <div className="home-grid">
      <div className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <Icon name="spark" size={16} /> AI guide for NEAR
            </p>
            <h1>
              Everything on NEAR, <span>made easy.</span>
            </h1>
            <p className="lede">Ask in plain English. Connect a wallet, review a testnet quote, or stake testnet NEAR.</p>
            <p className="notice">
              You approve every signature in your wallet. This app never asks for a seed phrase. Funding and staking are testnet only. Test wNEAR is not native NEAR, and a success message appears only after the network confirms it.
            </p>
            <Capability
              ready={store.accountId ? 'Wallet account is signed in' : 'Guides, quotes, and testnet staking previews work'}
              chain="Mainnet transfers stay off"
            />
          </div>
          <HeroArt />
        </section>

        <form
          className="command"
          onSubmit={(event) => {
            event.preventDefault();
            go(text);
          }}
        >
          <Icon name="spark" />
          <label className="sr-only" htmlFor="command-input">
            What do you want to do on NEAR?
          </label>
          <input
            id="command-input"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError('');
            }}
            placeholder="What would you like to do?"
            autoComplete="off"
          />
          <button type="submit" className="command-go" aria-label="Submit request">
            <Icon name="arrow" />
          </button>
        </form>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="try-row">
          <span>Try:</span>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => go(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>

        <div className="section-head">
          <div>
            <h2>Quick actions</h2>
            <p>Open a guided page. Funds move only after you approve.</p>
          </div>
          <Link to="/roadmap">View all features</Link>
        </div>
        <div className="qa-grid">
          <ActionCard
            icon="wallet"
            title="Wallet Assistant"
            body="Check a balance and what your wallet can show."
            badge={<Badge tone="accent">Preview</Badge>}
            onClick={() => go('Check my NEAR wallet.')}
          />
          <ActionCard
            icon="arrows"
            title="Move Funds"
            body="Get a Tidepool testnet quote. Mainnet stays off."
            badge={<Badge tone="warn">Testnet</Badge>}
            to="/funding"
          />
          <ActionCard
            icon="layers"
            title="Easy Staking"
            body="Review a testnet stake before your wallet approves."
            badge={<Badge tone="accent">Available (Testnet)</Badge>}
            to="/staking"
          />
        </div>

        <div className="section-head">
          <div>
            <h2>More ways to use NEAR</h2>
            <p>Ready items work today. Everything else is labelled.</p>
          </div>
          <div className="pills">
            <Link to="/roadmap">All {counts.all}</Link>
            <Link to="/roadmap?status=available">Ready {counts.available}</Link>
            <Link to="/roadmap?status=building">In development {counts.building}</Link>
            <Link to="/roadmap?status=soon">Soon {counts.soon}</Link>
          </div>
        </div>
        <div className="tile-grid">
          {homeTiles.map((tile) => (
            <Link key={tile.name} to={tile.href} className="tile">
              <Icon name={tile.icon as IconName} />
              <strong>{tile.name}</strong>
              <Badge tone={tile.status === 'soon' ? 'muted' : tile.status === 'building' ? 'warn' : 'accent'}>
                {tile.name === 'All Features' ? '30' : statusLabel[tile.status]}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <aside className="home-rail" aria-label="Wallet and activity">
        <section className="card wallet-card">
          <header className="card-head">
            <span>
              <Icon name="wallet" /> My NEAR Wallet
            </span>
            <em className={store.accountId ? 'status-pill live' : store.balance.kind === 'sample' ? 'status-pill sample' : 'status-pill'}>
              <i />
              {store.accountId ? 'Connected' : store.balance.kind === 'sample' ? 'Sample' : 'Not connected'}
            </em>
          </header>
          <p className="balance">
            {store.balance.loading && !store.balance.total ? (
              'Reading…'
            ) : store.balance.total ? (
              <>
                {store.balance.total} <small>NEAR</small>
              </>
            ) : (
              <>
                — <small>NEAR</small>
              </>
            )}
          </p>
          <p className="hint">
            {store.accountId
              ? `${store.accountId} on ${store.network}. A price feed is not connected.`
              : store.balance.kind === 'sample'
                ? 'Example balance. A price feed is not connected.'
                : 'Connect a wallet to read a balance from NEAR.'}
          </p>
          {store.balance.kind === 'live' && store.balance.note ? <p className="hint">{store.balance.note}</p> : null}
          {store.balance.error ? <p className="field-error">{store.balance.error}</p> : null}
          {store.accountId ? null : (
            <button type="button" className="btn btn-primary btn-block" onClick={store.connectWallet} disabled={store.walletPhase === 'connecting'}>
              {store.walletPhase === 'connecting' ? 'Waiting for your wallet…' : 'Connect wallet'}
            </button>
          )}
          <div className="shortcut-row">
            <Link to="/wallet" state={{ panel: 'send' }} className="btn btn-primary btn-sm">
              <Icon name="send" size={16} /> Send
            </Link>
            <Link to="/wallet" state={{ panel: 'receive' }} className="btn btn-secondary btn-sm">
              <Icon name="download" size={16} /> Receive
            </Link>
            <Link to="/staking" className="btn btn-secondary btn-sm">
              <Icon name="layers" size={16} /> Stake
            </Link>
          </div>
          {store.accountId ? (
            <p className="hint">Sample numbers stay hidden while a wallet is signed in.</p>
          ) : (
            <button type="button" className="text-btn" onClick={() => store.setSample(!store.sample)}>
              {store.sample ? 'Hide sample layout' : 'View sample layout'}
            </button>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <span>
              <Icon name="clock" /> Recent Activity
            </span>
            <Link to="/activity">View all</Link>
          </header>
          {rows.length ? (
            <ul className="activity-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <span className="bubble">
                    <Icon name={row.icon} size={16} />
                  </span>
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.detail}</small>
                  </span>
                  <span className="activity-side">
                    <strong>{row.amount}</strong>
                    <Badge tone={row.tone}>{row.badge}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : store.sample ? (
            <ul className="activity-list">
              <li>
                <span className="bubble">
                  <Icon name="layers" size={16} />
                </span>
                <span>
                  <strong>Staked NEAR</strong>
                  <small>Example row</small>
                </span>
                <span className="activity-side">
                  <strong>12.00 NEAR</strong>
                  <Badge tone="demo">Example</Badge>
                </span>
              </li>
              <li>
                <span className="bubble">
                  <Icon name="download" size={16} />
                </span>
                <span>
                  <strong>Received from Solana</strong>
                  <small>Example row</small>
                </span>
                <span className="activity-side">
                  <strong>100.00 USDC</strong>
                  <Badge tone="demo">Example</Badge>
                </span>
              </li>
            </ul>
          ) : (
            <div className="quiet-empty">
              <strong>No saved result yet</strong>
              <p>A stake appears after NEAR confirms it. A funding row appears after Tidepool returns a status.</p>
            </div>
          )}
        </section>

        <section className="promo">
          <div>
            <h2>Explore apps</h2>
            <p>Public NEAR projects. This app does not run them.</p>
            <Link to="/explore" className="btn btn-primary">
              Explore Apps <Icon name="arrow" size={16} />
            </Link>
          </div>
          <LogoMark size={48} />
        </section>
      </aside>
    </div>
  );
}
