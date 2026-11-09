import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { glossary } from './data';
import { Icon, LogoMark } from './icons';
import type { IconName } from './icons';
import { ConnectPanel } from './near/ConnectPanel';
import { shortAccount } from './near/format';
import { useStore } from './store';
import { Modal } from './ui';

const nav: { to: string; label: string; icon: IconName; end?: boolean; badge?: string }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/assistant', label: 'Assistant', icon: 'spark' },
  { to: '/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/funding', label: 'Funding', icon: 'arrows' },
  { to: '/staking', label: 'Staking', icon: 'layers' },
  { to: '/explore', label: 'Explore', icon: 'compass' },
  { to: '/roadmap', label: 'Features', icon: 'grid', badge: '30' },
  { to: '/activity', label: 'Activity', icon: 'clock' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const morePaths = ['/funding', '/staking', '/roadmap', '/activity', '/settings'];

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Shell({ children }: { children: ReactNode }) {
  const store = useStore();
  const [bellOpen, setBellOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const moreActive = morePaths.some((path) => location.pathname.startsWith(path));
  const connected = store.walletPhase === 'connected' && Boolean(store.accountId);
  const statusLabel = connected && store.accountId ? shortAccount(store.accountId) : store.sample ? 'Sample layout' : store.walletPhase === 'connecting' ? 'Connecting' : 'Not connected';
  const statusDetail = connected ? `${store.walletName} · ${store.network}` : store.sample ? 'example.near' : 'Connect a wallet';
  const connLabel = connected && store.accountId ? shortAccount(store.accountId) : store.sample ? 'Sample' : store.walletPhase === 'connecting' ? 'Connecting' : 'Not connected';

  useEffect(() => {
    setMoreOpen(false);
    setBellOpen(false);
    const id = location.hash.startsWith('#') ? decodeURIComponent(location.hash.slice(1)) : '';
    function align() {
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      const node = id ? document.getElementById(id) : null;
      if (!node) window.scrollTo(0, 0);
      else {
        const top = node.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo(0, Math.max(0, top));
      }
      root.style.scrollBehavior = previous;
    }
    align();
    const frame = window.requestAnimationFrame(align);
    const timer = window.setTimeout(align, 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.hash]);

  return (
    <div className={store.collapsed ? 'app is-collapsed' : 'app'}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-row">
          <Link to="/" className="brand">
            <LogoMark />
            <span className="brand-text">
              <span className="brand-name">
                NEAR <span>Easy</span>
              </span>
              <span className="brand-tag">AI guide for NEAR</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn collapse-btn"
            aria-expanded={!store.collapsed}
            aria-label={store.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => store.setCollapsed(!store.collapsed)}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <nav className="side-nav">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link" aria-label={item.label} title={item.label}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge ? <em className="nav-badge">{item.badge}</em> : null}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="user-chip" onClick={store.openConnect}>
          <span className="avatar" aria-hidden="true">
            <Icon name="user" />
          </span>
          <span className="user-meta">
            <strong id="wallet-status">{statusLabel}</strong>
            <small>{statusDetail}</small>
          </span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <Link to="/" className="topbar-brand">
            <LogoMark size={28} />
            <span>
              NEAR <span>Easy</span>
            </span>
          </Link>
          <div className="topbar-actions">
            <button
              type="button"
              className={connected ? 'conn-btn is-live' : 'conn-btn'}
              onClick={store.openConnect}
              aria-label={connected && store.accountId ? `Signed in as ${store.accountId} on ${store.network}` : store.sample ? 'Sample layout. Wallet not connected' : 'Wallet not connected'}
            >
              <span className="status-dot" />
              <span className="conn-label">{connLabel}</span>
            </button>
            <div className="menu-wrap" ref={bellRef}>
              <button
                type="button"
                className="icon-btn"
                aria-label="Notifications"
                aria-expanded={bellOpen}
                aria-haspopup="menu"
                onClick={() => setBellOpen((open) => !open)}
              >
                <Icon name="bell" />
              </button>
              {bellOpen ? (
                <div className="menu" role="menu">
                  <strong>Notifications</strong>
                  <p>
                    {store.notes.product
                      ? 'Product notes can be saved on this device. No live feed is connected.'
                      : 'Product notes are off.'}{' '}
                    {store.notes.activity
                      ? 'Activity alerts are preferred, but there is no activity service yet.'
                      : 'Activity alerts are off.'}
                  </p>
                  <Link to="/settings#notifications" onClick={() => setBellOpen(false)}>
                    Notification settings
                  </Link>
                </div>
              ) : null}
            </div>
            <Link to="/settings" className="icon-btn" aria-label="Settings">
              <Icon name="settings" />
            </Link>
          </div>
        </header>
        <main id="main" className="main">
          {store.sample && !store.accountId ? (
            <div className="sample-banner" role="status">
              <strong>Sample layout.</strong> Balances marked Sample are examples. They are not a live wallet.
            </div>
          ) : null}
          {children}
        </main>
        <footer className="statusbar">
          <Link to="/" className="foot-brand">
            <LogoMark size={28} />
            <span>
              <strong>
                NEAR <span>Easy</span>
              </strong>
              <small>AI guide for NEAR</small>
            </span>
          </Link>
          <div className="foot-points">
            <div>
              <Icon name="zap" />
              <span>
                <strong>Simple</strong>
                <small>No complex steps</small>
              </span>
            </div>
            <div>
              <Icon name="shield" />
              <span>
                <strong>Secure</strong>
                <small>You approve every transaction</small>
              </span>
            </div>
            <div>
              <Icon name="arrows" />
              <span>
                <strong>Multi-chain</strong>
                <small>Testnet quotes from other chains</small>
              </span>
            </div>
            <div>
              <Icon name="infinity" />
              <span>
                <strong>Always Growing</strong>
                <small>30 features on the roadmap</small>
              </span>
            </div>
          </div>
          <div className="foot-links">
            <a href="https://docs.near.org/" target="_blank" rel="noreferrer">
              Docs
            </a>
            <Link to="/roadmap">Roadmap</Link>
            <Link to="/settings#help">Support</Link>
          </div>
        </footer>
      </div>

      <nav className="tabbar" aria-label="Mobile">
        <NavLink to="/" end>
          <Icon name="home" />
          Home
        </NavLink>
        <NavLink to="/assistant">
          <Icon name="spark" />
          Ask
        </NavLink>
        <NavLink to="/wallet">
          <Icon name="wallet" />
          Wallet
        </NavLink>
        <NavLink to="/explore">
          <Icon name="compass" />
          Explore
        </NavLink>
        <button type="button" className={moreActive ? 'tab-on' : ''} aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
          <Icon name="grid" />
          More
        </button>
      </nav>

      <Modal open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="more-list">
          {nav
            .filter((item) => morePaths.includes(item.to))
            .map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
        </div>
      </Modal>

      <Modal open={store.connectOpen} title={connected ? 'Wallet' : 'Connect a wallet'} onClose={store.closeConnect}>
        <ConnectPanel />
      </Modal>

      <Modal open={store.glossaryOpen} title="Plain-English glossary" onClose={store.closeGlossary}>
        <dl className="glossary">
          {glossary.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.body}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
