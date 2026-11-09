import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { requestAssistant } from './assistantClient';
import { turnsForModel } from './assistantContract';
import type { AssistantAction, ChatTurn, WalletSnapshot } from './assistantContract';
import { matchIntent } from './logic';
import type { Intent, Mode } from './logic';
import { buildBalance } from './near/present';
import type { BalanceView } from './near/present';
import { useNearWallet } from './near/useWallet';

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      prompt: string;
      localIntent: Intent;
      action: AssistantAction | null;
      text: string;
      status: 'loading' | 'ready' | 'error';
      error: string;
    };

type Notes = { product: boolean; activity: boolean };

type Store = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  notes: Notes;
  setNotes: (notes: Notes) => void;
  sample: boolean;
  setSample: (on: boolean) => void;
  collapsed: boolean;
  setCollapsed: (on: boolean) => void;
  messages: ChatMessage[];
  pending: boolean;
  send: (text: string) => void;
  clearChat: () => void;
  connectOpen: boolean;
  openConnect: () => void;
  closeConnect: () => void;
  network: 'mainnet' | 'testnet';
  walletPhase: 'disconnected' | 'connecting' | 'connected' | 'error';
  accountId: string | null;
  accounts: string[];
  walletName: string;
  walletError: string;
  balance: BalanceView;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchWallet: () => Promise<void>;
  selectAccount: (id: string) => void;
  setNetwork: (network: 'mainnet' | 'testnet') => Promise<void>;
  stopWaiting: () => void;
  refreshHoldings: () => void;
  glossaryOpen: boolean;
  openGlossary: () => void;
  closeGlossary: () => void;
  savedNote: string;
};

const StoreContext = createContext<Store | null>(null);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode can block storage. Preferences still work for this visit. */
  }
}

function readNotes(): Notes {
  const raw = readStorage('near-easy-notes');
  if (!raw) return { product: true, activity: false };
  try {
    const parsed = JSON.parse(raw) as Partial<Notes>;
    return { product: Boolean(parsed.product), activity: Boolean(parsed.activity) };
  } catch {
    return { product: true, activity: false };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const wallet = useNearWallet();
  const [mode, setModeState] = useState<Mode>(() => (readStorage('near-easy-mode') === 'advanced' ? 'advanced' : 'simple'));
  const [notes, setNotesState] = useState<Notes>(readNotes);
  const [sample, setSampleState] = useState(() => readStorage('near-easy-sample') === '1');
  const [collapsed, setCollapsedState] = useState(() => readStorage('near-easy-sidebar') === 'collapsed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const flight = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => flight.current?.abort(), []);

  const api = useMemo<Store>(() => {
    const balance = buildBalance({
      sample,
      accountId: wallet.accountId,
      read: wallet.chainRead,
      loading: wallet.holdingsLoading,
      error: wallet.holdingsError,
    });
    function setMode(next: Mode) {
      setModeState(next);
      writeStorage('near-easy-mode', next);
    }
    function setNotes(next: Notes) {
      setNotesState(next);
      writeStorage('near-easy-notes', JSON.stringify(next));
      setSavedNote('Saved on this device.');
    }
    function setSample(on: boolean) {
      if (wallet.accountId) return;
      setSampleState(on);
      writeStorage('near-easy-sample', on ? '1' : '0');
    }
    function setCollapsed(on: boolean) {
      setCollapsedState(on);
      writeStorage('near-easy-sidebar', on ? 'collapsed' : 'open');
    }
    function snapshot(): WalletSnapshot {
      return {
        connected: Boolean(wallet.accountId),
        accountId: wallet.accountId,
        network: wallet.network,
        walletName: wallet.walletName,
        source: balance.kind,
        total: balance.total,
        available: balance.available,
        staked: balance.staked,
        pending: balance.pending,
        withdrawable: balance.withdrawable,
        locked: balance.locked,
        loading: balance.loading,
        error: balance.error,
        note: balance.note,
        partial: balance.partial,
        pools: balance.pools,
      };
    }
    function send(text: string) {
      const clean = text.trim();
      if (!clean || busy.current) return;
      busy.current = true;
      const id = crypto.randomUUID();
      const assistantId = `${id}-a`;
      const history: ChatTurn[] = turnsForModel(messages).map((item) => ({ role: item.role, text: item.text.slice(0, 2000) }));
      history.push({ role: 'user', text: clean.slice(0, 2000) });
      const userMessage: ChatMessage = { id, role: 'user', text: clean };
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        prompt: clean,
        localIntent: matchIntent(clean),
        action: null,
        text: '',
        status: 'loading',
        error: '',
      };
      setMessages((current) => [...current, userMessage, placeholder].slice(-40));
      const controller = new AbortController();
      flight.current = controller;
      void requestAssistant({
        mode,
        messages: history.slice(-16),
        wallet: snapshot(),
      }, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setMessages((current) => current.map((item) => (
          item.id === assistantId && item.role === 'assistant'
            ? { ...item, status: 'ready', text: result.reply, action: result.action, error: '' }
            : item
        )));
      }).catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        const message = error instanceof Error && error.message
          ? error.message
          : 'The assistant could not answer. Nothing was changed.';
        setMessages((current) => current.map((item) => (
          item.id === assistantId && item.role === 'assistant'
            ? { ...item, status: 'error', text: '', action: null, error: message }
            : item
        )));
      }).finally(() => {
        if (flight.current === controller) {
          flight.current = null;
          busy.current = false;
        }
      });
    }
    function clearChat() {
      flight.current?.abort();
      flight.current = null;
      busy.current = false;
      setMessages([]);
    }
    return {
      mode,
      setMode,
      notes,
      setNotes,
      sample,
      setSample,
      collapsed,
      setCollapsed,
      messages,
      pending: messages.some((item) => item.role === 'assistant' && item.status === 'loading'),
      send,
      clearChat,
      connectOpen: wallet.connectOpen,
      openConnect: wallet.openConnect,
      closeConnect: wallet.closeConnect,
      network: wallet.network,
      walletPhase: wallet.walletPhase,
      accountId: wallet.accountId,
      accounts: wallet.accounts,
      walletName: wallet.walletName,
      walletError: wallet.walletError,
      balance,
      connectWallet: wallet.connectWallet,
      disconnectWallet: wallet.disconnectWallet,
      switchWallet: wallet.switchWallet,
      selectAccount: wallet.selectAccount,
      setNetwork: wallet.setNetwork,
      stopWaiting: wallet.stopWaiting,
      refreshHoldings: wallet.refreshHoldings,
      glossaryOpen,
      openGlossary: () => setGlossaryOpen(true),
      closeGlossary: () => setGlossaryOpen(false),
      savedNote,
    };
  }, [mode, notes, sample, collapsed, messages, glossaryOpen, savedNote, wallet]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Store missing');
  return store;
}
