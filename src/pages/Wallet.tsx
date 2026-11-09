import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sampleWallet } from '../data';
import { readFundingActivity } from '../funding/plan';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { isNearAccount, normalizeAccount, parseAmount } from '../logic';
import { amountExceeds } from '../near/format';
import { nearLine } from '../near/present';
import { readStakeActivity } from '../near/stakePlan';
import { useStore } from '../store';
import { Badge, Button, Capability, CopyButton, EmptyState, Field, Modal, TxTable, useTitle } from '../ui';

export function WalletPage() {
  useTitle('Wallet');
  const store = useStore();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendStep, setSendStep] = useState<'form' | 'review' | 'stopped'>('form');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  function resetSend() {
    setSendStep('form');
    setError('');
  }

  function reviewSend() {
    if (!isNearAccount(to)) {
      setError('Enter a NEAR account such as name.near or name.testnet.');
      return;
    }
    const value = parseAmount(amount);
    if (!value) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (store.balance.kind === 'live' && store.balance.availableYocto && amountExceeds(amount, store.balance.availableYocto)) {
      setError(`That is above the available balance of ${store.balance.available} NEAR.`);
      return;
    }
    if (store.balance.kind === 'sample' && value > Number(sampleWallet.available)) {
      setError(`That is above the sample available balance of ${sampleWallet.available} NEAR. Your real balance is still unknown.`);
      return;
    }
    setError('');
    setSendStep('review');
  }

  const connected = Boolean(store.accountId);
  const location = useLocation();
  const saved = [
    ...readStakeActivity().map((item) => ({
      id: item.hash,
      title: 'Stake',
      detail: `${item.amount} NEAR on ${item.network}`,
      badge: 'NEAR confirmed',
      tone: 'accent' as const,
      icon: 'layers' as IconName,
      when: item.when,
    })),
    ...readFundingActivity().map((item) => ({
      id: item.depositAddress,
      title: 'Funding',
      detail: item.label,
      badge: item.status === 'SUCCESS' ? 'Tidepool SUCCESS' : item.label,
      tone: item.status === 'SUCCESS' ? 'accent' as const : item.status === 'FAILED' || item.status === 'REFUNDED' ? 'danger' as const : 'warn' as const,
      icon: 'arrows' as IconName,
      when: item.when,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 3);

  useEffect(() => {
    const panel = (location.state as { panel?: string } | null)?.panel;
    if (panel === 'send') {
      setSendOpen(true);
      setReceiveOpen(false);
    } else if (panel === 'receive') {
      setReceiveOpen(true);
      setSendOpen(false);
    }
  }, [location.state]);

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">My Wallet</h1>
          <p className="lede">Balances come from NEAR after you connect. Sample numbers stay marked. Send does not broadcast.</p>
          <Capability
            ready={connected ? 'Account and NEAR balance are read from the network' : 'Send and receive previews work'}
            chain={connected ? 'Send does not broadcast yet' : 'No wallet is connected'}
          />
        </div>
        <Button variant="primary" onClick={connected ? store.openConnect : store.connectWallet} disabled={!connected && store.walletPhase === 'connecting'}>
          {connected ? 'Wallet account' : store.walletPhase === 'connecting' ? 'Waiting for your wallet…' : 'Connect wallet'}
        </Button>
      </div>

      <section className="card portfolio-hero">
        <div>
          <span className="hint">Total NEAR</span>
          <p className="balance">
            {store.balance.loading && !store.balance.total ? 'Reading…' : store.balance.total ? <>{store.balance.total} <small>NEAR</small></> : <>{'—'} <small>NEAR</small></>}
          </p>
          <p className="hint">
            {store.balance.kind === 'sample'
              ? 'Example total. No dollar price is connected.'
              : store.balance.kind === 'live'
                ? store.balance.partial
                  ? 'No dollar price is connected. This total is incomplete.'
                  : 'No dollar price is connected.'
                : 'No wallet is connected, so the total is unknown.'}
          </p>
          {store.balance.kind === 'live' && store.balance.note ? <p className="hint">{store.balance.note}</p> : null}
          {store.balance.error ? <p className="field-error">{store.balance.error}</p> : null}
          {store.walletError && !connected ? <p className="field-error">{store.walletError}</p> : null}
          <div className="shortcut-row">
            <Button variant="primary" onClick={() => { resetSend(); setSendOpen(true); }}>
              <Icon name="send" size={16} /> Send
            </Button>
            <Button onClick={() => setReceiveOpen(true)}>
              <Icon name="download" size={16} /> Receive
            </Button>
            <Link to="/staking" className="btn btn-secondary">
              <Icon name="layers" size={16} /> Stake
            </Link>
          </div>
        </div>
        <div className="chart-placeholder" aria-hidden="true">
          {store.balance.kind === 'sample' ? (
            <svg viewBox="0 0 320 120">
              <path d="M0 80 C 40 80, 50 40, 90 48 S 150 100, 190 70 250 30, 320 46" fill="none" stroke="#35F5A0" strokeWidth="2.5" />
            </svg>
          ) : (
            <p>A price history chart is not connected.</p>
          )}
          {store.balance.kind === 'sample' ? <small>Example shape. Not price history.</small> : null}
        </div>
      </section>

      <div className="stat-grid">
        {[
          ['NEAR balance', nearLine(store.balance, 'total')],
          ['Available', nearLine(store.balance, 'available')],
          ['Staked', nearLine(store.balance, 'staked')],
          ['Pending unstake', nearLine(store.balance, 'pending')],
        ].map(([label, value]) => (
          <section key={label} className="card stat">
            <span>{label}</span>
            <strong>{value}</strong>
            {store.balance.kind === 'sample' ? <Badge tone="demo">Sample</Badge> : store.balance.kind === 'live' ? <span className="hint">{store.network}</span> : <span className="hint">Not connected</span>}
          </section>
        ))}
      </div>
      {store.balance.kind === 'live' && store.balance.withdrawable && store.balance.withdrawable !== '0' && !store.balance.withdrawable.startsWith('<') ? (
        <p className="hint">Ready to withdraw: {store.balance.withdrawable} NEAR. It is still in a staking pool until a withdraw is sent. This page cannot withdraw it.</p>
      ) : null}

      <div className="split">
        <section className="card">
          <header className="card-head">
            <span>Account</span>
          </header>
          {connected && store.accountId ? (
            <>
              <p className="mono">{store.accountId}</p>
              <CopyButton value={store.accountId} label="Copy account" />
              <p className="hint">This is the account from your wallet on {store.network}. NEAR Easy does not ask for a seed phrase or private key.</p>
            </>
          ) : store.balance.kind === 'sample' ? (
            <>
              <p className="mono">{sampleWallet.account}</p>
              <CopyButton value={sampleWallet.account} label="Copy sample address" />
              <p className="hint">This address is an example. It is not a deposit address for your funds.</p>
            </>
          ) : (
            <EmptyState
              icon="wallet"
              title="No account to show"
              body="Choose a wallet you control. The account appears after that wallet approves the connection."
              action={
                <Button variant="primary" onClick={store.connectWallet} disabled={store.walletPhase === 'connecting'}>
                  {store.walletPhase === 'connecting' ? 'Waiting for your wallet…' : 'Connect wallet'}
                </Button>
              }
            />
          )}
          {connected ? (
            <p className="hint">Sample numbers stay hidden while a wallet is signed in.</p>
          ) : (
            <button type="button" className="text-btn" onClick={() => store.setSample(!store.sample)}>
              {store.sample ? 'Hide sample layout' : 'View sample layout'}
            </button>
          )}
        </section>
        <section className="card">
          <header className="card-head">
            <span>Recent transactions</span>
            <Link to="/activity">Activity</Link>
          </header>
          {saved.length ? (
            <ul className="activity-list">
              {saved.map((item) => (
                <li key={item.id}>
                  <span className="bubble"><Icon name={item.icon} size={16} /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Badge tone={item.tone}>{item.badge}</Badge>
                </li>
              ))}
            </ul>
          ) : store.sample ? (
            <ul className="activity-list">
              <li>
                <span className="bubble"><Icon name="layers" size={16} /></span>
                <span>
                  <strong>Example stake</strong>
                  <small>No transaction hash</small>
                </span>
                <Badge tone="demo">Example</Badge>
              </li>
            </ul>
          ) : (
            <EmptyState icon="clock" title="No saved result" body="A stake is listed after NEAR confirms it. A funding row is listed after Tidepool returns a status." />
          )}
        </section>
      </div>

      <Modal
        open={sendOpen}
        title="Send NEAR"
        onClose={() => setSendOpen(false)}
      >
        {sendStep === 'form' ? (
          <>
            <p>This form checks the account and the amount. It does not create a transaction.</p>
            {store.balance.kind === 'live' && store.balance.available ? (
              <p className="hint">The amount is checked against the available balance of {store.balance.available} NEAR. Reviewing does not send it.</p>
            ) : store.balance.kind === 'sample' ? (
              <p className="hint">The amount is checked against the sample available balance of {sampleWallet.available} NEAR only.</p>
            ) : (
              <p className="hint">Your available balance is unknown, so the amount is not checked against funds.</p>
            )}
            <Field id="send-to" label="Recipient" error={error.includes('account') ? error : undefined}>
              <input id="send-to" value={to} autoCapitalize="none" spellCheck={false} placeholder="name.near or name.testnet" onChange={(event) => { setTo(event.target.value); setError(''); }} onBlur={() => setTo((value) => normalizeAccount(value))} />
            </Field>
            <Field id="send-amount" label="Amount (NEAR)" error={error && !error.includes('account') ? error : undefined}>
              <input id="send-amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} />
            </Field>
            <div className="modal-actions">
              <Button variant="primary" onClick={reviewSend}>Review</Button>
              <Button onClick={() => setSendOpen(false)}>Cancel</Button>
            </div>
          </>
        ) : null}
        {sendStep === 'review' ? (
          <>
            <TxTable rows={[{ label: 'To', value: normalizeAccount(to) }, { label: 'Amount', value: `${amount} NEAR` }, { label: 'Status', value: 'Not sent' }]} />
            <div className="modal-actions">
              <Button onClick={() => setSendStep('form')}>Edit</Button>
              <Button variant="primary" onClick={() => setSendStep('stopped')}>Finish preview</Button>
            </div>
          </>
        ) : null}
        {sendStep === 'stopped' ? (
          <>
            <p className="warn-box" role="status">Nothing was sent. No wallet was asked to sign.</p>
            <div className="modal-actions">
              <Button variant="primary" onClick={() => setSendOpen(false)}>Close</Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={receiveOpen} title="Receive" onClose={() => setReceiveOpen(false)}>
        {connected && store.accountId ? (
          <>
            <p>Send NEAR to this account on {store.network}. Check the account before you send from another wallet.</p>
            <p className="mono">{store.accountId}</p>
            <CopyButton value={store.accountId} label="Copy account" />
          </>
        ) : store.balance.kind === 'sample' ? (
          <>
            <p>Sample account only. Do not send funds here.</p>
            <p className="mono">{sampleWallet.account}</p>
            <CopyButton value={sampleWallet.account} label="Copy sample address" />
          </>
        ) : (
          <EmptyState icon="download" title="No address yet" body="There is no receive address because no wallet is connected." />
        )}
      </Modal>
    </div>
  );
}
