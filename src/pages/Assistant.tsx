import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { assistantConfigured } from '../assistantClient';
import { assistantSuggestions } from '../data';
import { Icon } from '../icons';
import { parseStakeAsk } from '../logic';
import type { Intent } from '../logic';
import { useStore } from '../store';
import type { ChatMessage } from '../store';
import { Badge, Capability, useTitle } from '../ui';
import { ChatFunding, ChatStake } from './ChatActions';

type AssistantTurn = Extract<ChatMessage, { role: 'assistant' }>;

function workflowIntent(message: AssistantTurn): Intent {
  if (message.localIntent === 'execute-blocked') return 'execute-blocked';
  if (message.localIntent === 'fund-stake' || message.action === 'fund-stake') return 'fund-stake';
  if (message.localIntent !== 'unknown') return message.localIntent;
  if (message.action === 'wallet') return 'wallet';
  if (message.action === 'stake') return 'stake';
  if (message.action === 'fund') return 'fund';
  if (message.action === 'explore') return 'discover';
  if (message.action === 'start') return 'start';
  return 'unknown';
}

function stakingPath(prompt: string): string {
  const amount = parseStakeAsk(prompt);
  return amount ? `/staking?amount=${encodeURIComponent(amount)}` : '/staking';
}

function SuggestionList({ onPick, disabled }: { onPick: (value: string) => void; disabled: boolean }) {
  return (
    <div className="suggest-groups">
      <div>
        <p className="hint">Staking</p>
        <div className="suggest-grid">
          {assistantSuggestions.staking.map((suggestion) => (
            <button key={suggestion} type="button" className="suggest" disabled={disabled} onClick={() => onPick(suggestion)}>
              <Icon name="spark" size={16} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="hint">Funding</p>
        <div className="suggest-grid">
          {assistantSuggestions.funding.map((suggestion) => (
            <button key={suggestion} type="button" className="suggest" disabled={disabled} onClick={() => onPick(suggestion)}>
              <Icon name="spark" size={16} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Workflow({ intent, prompt }: { intent: Intent; prompt: string }) {
  if (intent === 'execute-blocked') {
    return (
      <p className="warn-box" role="status">
        A sentence does not approve a transaction. Use Approve in wallet on the preview. Nothing is signed until you do.
      </p>
    );
  }
  const stakeAmount = parseStakeAsk(prompt);
  const items = intent === 'wallet'
    ? [{ label: 'Wallet', to: '/wallet', text: 'Open the account. Nothing is sent.' }]
    : intent === 'stake'
      ? [{ label: 'Easy Staking', to: stakingPath(prompt), text: /\bunstak/i.test(prompt) ? 'Unstaking is not available. The staking page explains the wait.' : stakeAmount ? `Open staking for ${stakeAmount} NEAR. Your wallet must approve.` : 'Open staking and enter an amount. Your wallet must approve.' }]
      : intent === 'discover'
        ? [{ label: 'Directory', to: '/explore', text: 'Browse projects with public sites.' }]
        : intent === 'start'
            ? [
                { label: 'Wallet apps', to: '/explore?category=Wallets', text: 'Open the wallet list' },
                { label: 'Funding', to: '/funding', text: 'Open a Tidepool testnet quote' },
                { label: 'Wallet', to: '/wallet', text: 'Open the wallet page' },
              ]
            : [];
  if (!items.length) return null;
  return (
    <div className="action-row">
      {items.map((item) => (
        <Link key={item.label} className="action-card" to={item.to}>
          <strong>{item.label}</strong>
          <span>{item.text}</span>
        </Link>
      ))}
    </div>
  );
}

function ReplyText({ text }: { text: string }) {
  const parts = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => (
        <p key={`${index}-${part.slice(0, 24)}`}>{part}</p>
      ))}
    </>
  );
}

export function AssistantPage() {
  useTitle('Assistant');
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const consumed = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const state = location.state as { text?: string; nonce?: string } | null;

  useEffect(() => {
    const controller = new AbortController();
    void assistantConfigured(controller.signal).then((ready) => {
      if (!controller.signal.aborted) setConfigured(ready ? 'yes' : 'no');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!state?.text || !state.nonce) return;
    if (consumed.current === state.nonce) return;
    const seen = sessionStorage.getItem('near-easy-nonce');
    if (seen === state.nonce) {
      consumed.current = state.nonce;
      return;
    }
    consumed.current = state.nonce;
    sessionStorage.setItem('near-easy-nonce', state.nonce);
    store.send(state.text);
    navigate('/assistant', { replace: true, state: null });
  }, [navigate, state, store]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [store.messages, store.pending]);

  function submit(value: string) {
    if (store.pending) {
      setError('Wait for the current reply.');
      return;
    }
    if (!value.trim()) {
      setError('Type a request first.');
      return;
    }
    setError('');
    setDraft('');
    store.send(value);
  }

  const lede = configured === 'yes'
    ? 'Ask in everyday English. A live model answers from the server. A testnet stake or Tidepool quote can be approved here. Your wallet signs it. Mainnet stays off.'
    : configured === 'no'
      ? 'The assistant server has no API key, so a live reply is unavailable. A testnet preview can still be prepared. Nothing is signed until you approve it.'
      : 'Checking the assistant.';
  const ready = configured === 'yes'
    ? 'Live answers are on'
    : configured === 'no'
      ? 'Live answers need a server API key'
      : 'Checking the assistant';

  return (
    <div className="page assistant-page">
      <section className="chat-shell">
        <header className="chat-top">
          <div>
            <h1 className="page-title">Assistant</h1>
            <p className="lede">{lede}</p>
            <Capability ready={ready} chain="Mainnet stays off. The wallet still signs." />
          </div>
          <div className="mode-switch" role="radiogroup" aria-label="Explanation mode">
            <button type="button" role="radio" aria-checked={store.mode === 'simple'} className={store.mode === 'simple' ? 'on' : ''} onClick={() => store.setMode('simple')}>
              Simple
            </button>
            <button type="button" role="radio" aria-checked={store.mode === 'advanced'} className={store.mode === 'advanced' ? 'on' : ''} onClick={() => store.setMode('advanced')}>
              Advanced
            </button>
          </div>
        </header>

        <div className="thread" role="log" aria-live="polite" aria-relevant="additions">
          {store.messages.length === 0 && !store.pending ? (
            <div className="empty thread-empty">
              <span className="empty-icon">
                <Icon name="spark" />
              </span>
              <h2>Ask in plain English</h2>
              <p>Choose a prompt or ask in your own words. A preview appears here. Nothing is signed until you approve it.</p>
              <SuggestionList onPick={submit} disabled={store.pending} />
            </div>
          ) : null}

          {store.messages.map((message) =>
            message.role === 'user' ? (
              <article key={message.id} className="bubble-row user">
                <div className="speech">
                  <span className="who">You</span>
                  <p>{message.text}</p>
                </div>
              </article>
            ) : (
              <article key={message.id} className="bubble-row assistant">
                <div className="speech">
                  <span className="who">
                    Assistant
                    {message.status === 'ready' ? <Badge tone="accent">Live model</Badge> : null}
                    {message.status === 'error' ? <Badge tone="warn">No reply</Badge> : null}
                  </span>
                  <div>
                    {message.status === 'ready' ? <ReplyText text={message.text} /> : null}
                    {message.status === 'error' ? (
                      <p className="warn-box" role="alert">{message.error}</p>
                    ) : null}
                    {message.status === 'loading' ? (
                      <p className="loading-line" role="status" aria-busy="true">Asking the assistant…</p>
                    ) : null}
                  </div>
                  {workflowIntent(message) === 'stake' && !/\bunstak/i.test(message.prompt) ? (
                    <ChatStake prompt={message.prompt} />
                  ) : (workflowIntent(message) === 'fund' || workflowIntent(message) === 'fund-stake') ? (
                    <ChatFunding prompt={message.prompt} separateStake={workflowIntent(message) === 'fund-stake'} />
                  ) : (
                    <Workflow intent={workflowIntent(message)} prompt={message.prompt} />
                  )}
                  <p className="hint">Nothing is signed from the reply itself. A preview asks your wallet only after you press Approve.</p>
                  {message.status === 'error' ? (
                    <button type="button" className="text-btn" onClick={() => submit(message.prompt)}>
                      Try again
                    </button>
                  ) : null}
                </div>
              </article>
            ),
          )}
          <div ref={endRef} />
        </div>

        <div className="composer">
          {store.messages.length > 0 ? (
            <div className="suggest-bar" aria-label="Example prompts">
              <span className="hint">Staking</span>
              {assistantSuggestions.staking.map((suggestion) => (
                <button key={suggestion} type="button" className="chip" disabled={store.pending} onClick={() => submit(suggestion)}>
                  {suggestion}
                </button>
              ))}
              <span className="hint">Funding</span>
              {assistantSuggestions.funding.map((suggestion) => (
                <button key={suggestion} type="button" className="chip" disabled={store.pending} onClick={() => submit(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="command chat-command"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <Icon name="spark" />
            <label className="sr-only" htmlFor="chat-input">
              Message
            </label>
            <textarea
              id="chat-input"
              rows={2}
              value={draft}
              placeholder={store.pending ? 'Waiting for the reply…' : 'What would you like to do?'}
              disabled={store.pending}
              onChange={(event) => {
                setDraft(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
            />
            <button type="submit" className="command-go" aria-label="Send message" disabled={store.pending}>
              <Icon name="arrow" />
            </button>
          </form>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="inline-actions">
            <button type="button" className="text-btn" onClick={store.openGlossary}>
              What do these words mean?
            </button>
            {store.messages.length > 0 ? (
              <button type="button" className="text-btn" onClick={store.clearChat}>
                Clear conversation
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
