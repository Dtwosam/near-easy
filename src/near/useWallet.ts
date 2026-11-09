import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account } from '@hot-labs/near-connect';
import { readAccount } from './chain';
import type { AccountRead, NetworkId } from './chain';
import { clearSelectedWallet, getConnector } from './connector';
import { explainChainError, explainWalletError } from './errors';
import { isNearAccount } from '../logic';

export type WalletPhase = 'disconnected' | 'connecting' | 'connected' | 'error';

function readNetwork(): NetworkId {
  try {
    return localStorage.getItem('near-easy-network') === 'testnet' ? 'testnet' : 'mainnet';
  } catch {
    return 'mainnet';
  }
}

function writeNetwork(network: NetworkId) {
  try {
    localStorage.setItem('near-easy-network', network);
  } catch {
    /* The choice still applies for this visit. */
  }
}

function accountIds(accounts: Account[]): string[] {
  const ids = accounts.map((account) => account.accountId.trim().toLowerCase()).filter((id) => isNearAccount(id));
  return [...new Set(ids)];
}

export function useNearWallet() {
  const [network, setNetworkState] = useState<NetworkId>(readNetwork);
  const [phase, setPhase] = useState<WalletPhase>('disconnected');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [walletName, setWalletName] = useState('');
  const [walletError, setWalletError] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [read, setRead] = useState<AccountRead | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsError, setHoldingsError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  const networkRef = useRef(network);
  const accountRef = useRef(accountId);
  const accountsRef = useRef(accounts);
  const phaseRef = useRef(phase);
  const suppressRestore = useRef(false);
  const attemptRef = useRef(0);
  networkRef.current = network;
  accountRef.current = accountId;
  accountsRef.current = accounts;
  phaseRef.current = phase;

  function clearAccount() {
    setAccountId(null);
    setAccounts([]);
    setWalletName('');
    setRead(null);
    setHoldingsError('');
    setHoldingsLoading(false);
  }

  function applyAccounts(nextAccounts: Account[], name: string) {
    const ids = accountIds(nextAccounts);
    if (!ids.length) {
      clearAccount();
      setPhase('error');
      setWalletError('The wallet did not return an account.');
      return;
    }
    setAccounts(ids);
    setAccountId((current) => (current && ids.includes(current) ? current : ids[0]));
    setWalletName(name || 'Wallet');
    setPhase('connected');
    setWalletError('');
  }

  useEffect(() => {
    const connector = getConnector(network);
    let cancelled = false;

    function onSignIn(payload: { success: boolean; accounts: Account[]; wallet: { manifest: { name: string } } }) {
      if (cancelled || suppressRestore.current || !payload.success) return;
      applyAccounts(payload.accounts, payload.wallet.manifest.name);
    }
    function onSignOut() {
      if (cancelled || phaseRef.current === 'connecting') return;
      clearAccount();
      setPhase('disconnected');
    }

    connector.on('wallet:signIn', onSignIn);
    connector.on('wallet:signOut', onSignOut);
    if (!suppressRestore.current) {
      connector
        .getConnectedWallet()
        .then((result) => {
          if (cancelled || suppressRestore.current) return;
          applyAccounts(result.accounts, result.wallet.manifest.name);
        })
        .catch(() => {
          /* A fresh browser has no selected wallet. That is not an error. */
        });
    }

    return () => {
      cancelled = true;
      connector.off('wallet:signIn', onSignIn);
      connector.off('wallet:signOut', onSignOut);
    };
    // Listeners stay on the singleton. Re-subscribing every render would duplicate them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setHoldingsLoading(true);
    setHoldingsError('');
    readAccount(network, accountId)
      .then((result) => {
        if (cancelled) return;
        setRead(result);
        setHoldingsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRead(null);
        setHoldingsError(explainChainError(error));
        setHoldingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, network, refreshToken]);

  async function connectWallet() {
    if (phaseRef.current === 'connecting') return;
    suppressRestore.current = true;
    const attempt = ++attemptRef.current;
    setConnectOpen(true);
    setPhase('connecting');
    setWalletError('');
    try {
      const connector = getConnector(networkRef.current);
      await connector.whenManifestLoaded.catch(() => undefined);
      if (connector.availableWallets.length === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      if (connector.availableWallets.length === 0) throw new Error('Failed to load manifest');
      const wallet = await connector.connect();
      const signedIn = await wallet.getAccounts();
      applyAccounts(signedIn, wallet.manifest.name);
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      if (!accountRef.current) clearAccount();
      setPhase('error');
      setWalletError(explainWalletError(error));
    }
  }

  async function disconnectWallet() {
    suppressRestore.current = true;
    attemptRef.current += 1;
    const connector = getConnector(networkRef.current);
    try {
      await connector.disconnect();
    } catch {
      setWalletError('The wallet did not confirm sign-out. The account was cleared here. Sign out in the wallet too if it still appears.');
    }
    clearSelectedWallet();
    clearAccount();
    setPhase('disconnected');
  }

  async function switchWallet() {
    suppressRestore.current = true;
    const attempt = ++attemptRef.current;
    setConnectOpen(true);
    setPhase('connecting');
    setWalletError('');
    try {
      await getConnector(networkRef.current).disconnect();
    } catch {
      /* A new wallet can still be chosen. */
    }
    clearSelectedWallet();
    clearAccount();
    try {
      const connector = getConnector(networkRef.current);
      await connector.whenManifestLoaded.catch(() => undefined);
      if (connector.availableWallets.length === 0) throw new Error('Failed to load manifest');
      const wallet = await connector.connect();
      applyAccounts(await wallet.getAccounts(), wallet.manifest.name);
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      clearAccount();
      setPhase('error');
      setWalletError(explainWalletError(error));
    }
  }

  async function setNetwork(next: NetworkId) {
    if (next === networkRef.current) return;
    suppressRestore.current = true;
    attemptRef.current += 1;
    if (accountRef.current) {
      try {
        await getConnector(networkRef.current).disconnect();
      } catch {
        /* Local session is cleared even if the wallet stays signed in. */
      }
    }
    clearSelectedWallet();
    getConnector(next);
    writeNetwork(next);
    setNetworkState(next);
    clearAccount();
    setPhase('disconnected');
    setWalletError('');
  }

  function selectAccount(id: string) {
    if (!accountsRef.current.includes(id)) return;
    setAccountId(id);
  }

  function stopWaiting() {
    attemptRef.current += 1;
    setPhase(accountRef.current ? 'connected' : 'disconnected');
    setWalletError('');
  }

  return useMemo(
    () => ({
      network,
      walletPhase: phase,
      accountId,
      accounts,
      walletName,
      walletError,
      connectOpen,
      openConnect: () => setConnectOpen(true),
      closeConnect: () => setConnectOpen(false),
      connectWallet,
      disconnectWallet,
      switchWallet,
      selectAccount,
      setNetwork,
      stopWaiting,
      refreshHoldings: () => setRefreshToken((value) => value + 1),
      chainRead: read,
      holdingsLoading,
      holdingsError,
    }),
    // The functions close over refs and setters. They are recreated each render,
    // and this memo publishes the latest copies with the latest state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, phase, accountId, accounts, walletName, walletError, connectOpen, read, holdingsLoading, holdingsError],
  );
}
