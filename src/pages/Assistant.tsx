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
type Pane = 'chat' | 'action';

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

function isStakeWorkflow(message: AssistantTurn): boolean {
  return workflowIntent(message) === 'stake' && !/\bunstak/i.test(message.prompt);
}

function isFundingWorkflow(message: AssistantTurn): boolean {
  const intent = workflowIntent(message);
  return intent === 'fund' || intent === 'fund-stake';
}

function hasPanel(message: AssistantTurn): boolean {
  const intent = workflowIntent(message);
  return isStakeWorkflow(message) || isFundingWorkflow(message) || intent === 'wallet' || intent === 'discover' || intent === 'start' || intent === 'execute-blocked' || (intent === 'stake' && /\bunstak/i.test(message.prompt));
}

function activeTurn(messages: ChatMessage[]): AssistantTurn | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && hasPanel(message)) return message;
  }
  return null;
}

function panelTitle(message: AssistantTurn): string {
  if (isStakeWorkflow(message)) return 'Stake NEAR';
  if (isFundingWorkflow(message)) return 'Fund NEAR';
  return 'Action';
}

function panelLabel(message: AssistantTurn): string {
  if (isStakeWorkflow(message)) return 'Stake';
  if (isFundingWorkflow(message)) return 'Funding';
  if (workflowIntent(message) === 'wallet') return 'Wallet';
  if (workflowIntent(message) === 'discover') return 'Directory';
  if (workflowIntent(message) === 'start') return 'Get started';
  if (workflowIntent(message) === 'execute-blocked') return 'Approval';
  return 'Staking';
}

function panelCue(message: AssistantTurn, current: boolean): string {
  if (!current) return 'A newer request replaced this preview.';
  if (isStakeWorkflow(message)) return 'The stake preview is in the action panel. Nothing is signed until you approve it.';
  if (isFundingWorkflow(message)) return 'The funding preview is in the action panel. Nothing is signed until you approve it.';
  if (workflowIntent(message) === 'execute-blocked') return 'Approval stays on the action panel.';
  return 'The next step is in the action panel.';
}

function stakingPath(prompt: string): string {
  const amount = parseStakeAsk(prompt);
  return amount ? `/staking?amount=${encodeURIComponent(amount)}` : '/staking';
}

function useNarrow(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [query]);
  return matches;
}

function PromptDrawer({
  startOpen,
  disabled,
  onPick,
}: {
  startOpen: boolean;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <details
      className="prompt-drawer"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Example prompts</summary>
      <div className="prompt-groups">
        <div>
          <p className="hint">Staking</p>
          <div className="prompt-grid">
            {assistantSuggestions.staking.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" disabled={disabled} onClick={() => onPick(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="hint">Funding</p>
          <div className="prompt-grid">
            {assistantSuggestions.funding.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" disabled={disabled} onClick={() => onPick(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
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

function ActionBody({ message }: { message: AssistantTurn }) {
  if (isStakeWorkflow(message)) return <ChatStake prompt={message.prompt} />;
  if (isFundingWorkflow(message)) return <ChatFunding prompt={message.prompt} separateStake={workflowIntent(message) === 'fund-stake'} />;
  return <Workflow intent={workflowIntent(message)} prompt={message.prompt} />;
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
  const [pane, setPane] = useState<Pane>('chat');
  const narrow = useNarrow('(max-width: 960px)');
  const consumed = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const state = location.state as { text?: string; nonce?: string } | null;
  const active = activeTurn(store.messages);
  const empty = store.messages.length === 0;

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

  const activeId = active?.id ?? '';
  useEffect(() => {
    if (!narrow) return;
    setPane(activeId ? 'action' : 'chat');
  }, [activeId, narrow]);

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

  const ready = configured === 'yes'
    ? 'Live answers are on'
    : configured === 'no'
      ? 'Live answers need a server API key'
      : 'Checking the assistant';

  return (
    <div className="page assistant-page">
      <div className="pane-switch" role="tablist" aria-label="Assistant view">
        <button type="button" role="tab" aria-selected={pane === 'chat'} onClick={() => setPane('chat')}>
          Conversation
        </button>
        <button type="button" role="tab" aria-selected={pane === 'action'} onClick={() => setPane('action')}>
          Active action
          {active ? <em className="nav-badge">1</em> : null}
        </button>
      </div>
      <div className="assistant-workspace" data-pane={pane}>
        <section id="assistant-chat" className="chat-shell" hidden={narrow && pane !== 'chat'}>
          <header className="chat-top">
            <div>
              <h1 className="page-title">Assistant</h1>
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
            {empty && !store.pending ? (
              <div className="empty thread-empty">
                <h2>Ask in plain English</h2>
                <p>A preview opens in the action panel. Nothing is signed until you approve it.</p>
                <PromptDrawer key="empty-prompts" startOpen disabled={store.pending} onPick={submit} />
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
                    {hasPanel(message) ? <p className="hint">{panelCue(message, active?.id === message.id)}</p> : null}
                    {message.status === 'error' ? (
                      <button type="button" className="text-btn" onClick={() => submit(message.prompt)}>
                        Try again
                      </button>
                    ) : null}
                  </div>
                </article>
              ),
            )}
            {empty ? null : (
              <PromptDrawer key="chat-prompts" startOpen={false} disabled={store.pending} onPick={submit} />
            )}
            <div ref={endRef} />
          </div>

          <div className="composer">
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
                rows={1}
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

        <aside id="action-panel" className="action-panel" aria-label="Action panel" hidden={narrow && pane !== 'action'}>
          <header className="action-head">
            <h2>{active ? panelTitle(active) : 'Action'}</h2>
            {active && panelTitle(active) === 'Action' ? <Badge tone="accent">{panelLabel(active)}</Badge> : null}
          </header>
          <div className="action-scroll">
            {active ? (
              <ActionBody key={active.id} message={active} />
            ) : (
              <div className="action-empty">
                <h2>No active preview</h2>
                <p>Choose a stake or funding prompt. Validators, amounts, quotes, and approval stay here. Nothing is signed until you approve it.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
