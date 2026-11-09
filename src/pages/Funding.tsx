import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  loadFundingCatalog,
  loadFundingStatus,
  requestFundingQuote,
  requestTestTokens,
  submitFundingDeposit,
} from '../funding/client';
import { explainFundingError, requestFundingSignature } from '../funding/deposit';
import { approveBaseDeposit } from '../funding/evmWallet';
import { OriginWallet } from '../funding/OriginWallet';
import { explainOriginError, originExplorer, waitForOrigin } from '../funding/originPlan';
import { verifyBaseDeposit, verifyNearDeposit, verifySolanaDeposit } from '../funding/originRpc';
import { approveSolanaDeposit } from '../funding/solanaWallet';
import {
  chainLabel,
  depositLines,
  isDepositAddress,
  isDepositHash,
  isNearTestnetAccount,
  isOriginAddress,
  nearDepositAction,
  parseFundingAmount,
  pickToken,
  saveFundingActivity,
  tokensOn,
} from '../funding/plan';
import type { FundingCatalog, FundingStatus, PublicQuote, VerifiedHash } from '../funding/plan';
import { transactionHash } from '../near/stakePlan';
import { useStore } from '../store';
import { Button, Capability, ChoiceGroup, Field, Help, RouteVisual, Stepper, TxTable, useTitle } from '../ui';

const steps = ['Details', 'Quote', 'Deposit', 'Status'];

function chainFromQuery(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  const named: Record<string, string> = {
    sol: 'sol',
    solana: 'sol',
    'solana devnet': 'sol',
    base: 'base',
    'base sepolia': 'base',
    eth: 'eth',
    ethereum: 'eth',
    'ethereum sepolia': 'eth',
    arb: 'arb',
    arbitrum: 'arb',
    'arbitrum sepolia': 'arb',
    near: 'near',
    'near testnet': 'near',
    stellar: 'stellar',
    sui: 'sui',
    btc: 'btc',
    bitcoin: 'btc',
    xrp: 'xrp',
  };
  return named[text] ?? null;
}

function quoteRows(quote: PublicQuote) {
  return [
    { label: 'Source', value: `${quote.originLabel} · ${quote.originSymbol}` },
    { label: 'Amount in', value: `${quote.amountInFormatted} ${quote.originSymbol}`, hint: 'From the Tidepool quote.' },
    { label: 'Expected output', value: `${quote.amountOutFormatted} ${quote.destinationSymbol}`, hint: 'From the Tidepool quote.' },
    { label: 'Minimum output', value: quote.minAmountOutFormatted ? `${quote.minAmountOutFormatted} ${quote.destinationSymbol}` : 'Not in the quote' },
    { label: 'Quoted input value', value: quote.amountInUsd ? `${quote.amountInUsd} USD` : 'Not in the quote' },
    { label: 'Quoted output value', value: quote.amountOutUsd ? `${quote.amountOutUsd} USD` : 'Not in the quote' },
    {
      label: 'Value gap in the quote',
      value: quote.quotedValueGap ? `${quote.quotedValueGap} USD` : 'Not in the quote',
      hint: 'Input value minus output value. This includes the provider fee and any price gap.',
    },
    { label: 'Withdraw fee', value: quote.withdrawFee ? `${quote.withdrawFee} ${quote.destinationSymbol}` : 'Not in the quote' },
    { label: 'NEAR Easy fee', value: 'None. This app does not add a fee.' },
    { label: 'Time estimate', value: quote.timeEstimate == null ? 'Not in the quote' : `${quote.timeEstimate} seconds after the deposit is seen` },
    { label: 'Expiration', value: quote.deadline ?? 'Issued when you prepare the deposit' },
    { label: 'Provider', value: 'Tidepool testnet', hint: 'Community-operated. Not affiliated with NEAR.' },
  ];
}

export function FundingPage() {
  useTitle('Cross-chain funding');
  const store = useStore();
  const [params] = useSearchParams();
  const wantedChain = chainFromQuery(params.get('chain')) ?? 'sol';
  const wantedToken = params.get('token');
  const wantedDest = params.get('dest');
  const wantedAmount = params.get('amount');
  const wantedAccount = params.get('to');

  const [catalog, setCatalog] = useState<FundingCatalog | null>(null);
  const [loadError, setLoadError] = useState('');
  const [chain, setChain] = useState(wantedChain);
  const [originAsset, setOriginAsset] = useState('');
  const [destinationAsset, setDestinationAsset] = useState('');
  const [amount, setAmount] = useState(wantedAmount && parseFundingAmount(wantedAmount) ? wantedAmount : '');
  const [recipient, setRecipient] = useState(wantedAccount && isNearTestnetAccount(wantedAccount) ? wantedAccount.trim().toLowerCase() : '');
  const [refundTo, setRefundTo] = useState('');
  const [stage, setStage] = useState(0);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dryQuote, setDryQuote] = useState<PublicQuote | null>(null);
  const [liveQuote, setLiveQuote] = useState<PublicQuote | null>(null);
  const [status, setStatus] = useState<FundingStatus | null>(null);
  const [submittedHash, setSubmittedHash] = useState('');
  const [originNote, setOriginNote] = useState('');
  const [solanaWalletId, setSolanaWalletId] = useState('');
  const [solanaAccount, setSolanaAccount] = useState('');
  const [evmWalletId, setEvmWalletId] = useState('');
  const [evmAccount, setEvmAccount] = useState('');
  const [hashDraft, setHashDraft] = useState('');
  const [faucetNote, setFaucetNote] = useState('');
  const [trackAddress, setTrackAddress] = useState('');
  const [followLive, setFollowLive] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void loadFundingCatalog(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setCatalog(next);
        const source = pickToken(next.tokens, wantedChain, wantedToken) ?? pickToken(next.tokens, next.chains[0]?.id ?? 'sol', 'USDC');
        const near = pickToken(next.tokens, 'near', wantedDest) ?? pickToken(next.tokens, 'near', 'wNEAR');
        if (source) {
          setChain(source.blockchain);
          setOriginAsset(source.assetId);
        }
        if (near) setDestinationAsset(near.assetId);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : 'Tidepool tokens could not be loaded.');
      });
    return () => controller.abort();
  }, [wantedChain, wantedDest, wantedToken]);

  const originTokens = catalog ? tokensOn(catalog.tokens, chain) : [];
  const nearTokens = catalog ? tokensOn(catalog.tokens, 'near') : [];
  const origin = originTokens.find((token) => token.assetId === originAsset) ?? null;
  const destination = nearTokens.find((token) => token.assetId === destinationAsset) ?? null;
  const deposit = liveQuote ? nearDepositAction(liveQuote) : null;
  const canSign = Boolean(
    deposit
    && !store.sample
    && store.network === 'testnet'
    && store.walletPhase === 'connected'
    && store.accountId
    && isNearTestnetAccount(store.accountId),
  );

  useEffect(() => {
    if (!followLive || stage !== 3 || !liveQuote?.depositAddress) return;
    let stop = false;
    let timer = 0;
    const quote = liveQuote;
    const depositAddress: string = liveQuote.depositAddress;
    const memo = quote.depositMemo;
    async function tick() {
      try {
        const next = await loadFundingStatus(depositAddress, memo);
        if (stop) return;
        setStatus(next);
        remember(quote, next);
        if (!next.terminal) timer = window.setTimeout(() => void tick(), 4000);
      } catch (reason) {
        if (stop) return;
        setError(reason instanceof Error ? reason.message : 'Tidepool status could not be read.');
        timer = window.setTimeout(() => void tick(), 4000);
      }
    }
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [followLive, liveQuote, stage]);

  function remember(quote: PublicQuote, next: FundingStatus, extra?: VerifiedHash) {
    if (!quote.depositAddress) return;
    const hashes = extra && !next.hashes.some((item) => item.hash === extra.hash) ? [extra, ...next.hashes] : next.hashes;
    saveFundingActivity({
      depositAddress: quote.depositAddress,
      status: next.status,
      label: next.label,
      when: new Date().toISOString(),
      origin: `${quote.amountInFormatted} ${quote.originSymbol} on ${quote.originLabel}`,
      destination: `${quote.recipient} · ${quote.destinationSymbol}`,
      amountIn: next.amountInFormatted ?? quote.amountInFormatted,
      amountOut: next.amountOutFormatted ?? 'Not in the status',
      refundReason: next.refundReason ?? '',
      hashes,
    });
  }

  function selectChain(label: string) {
    const next = catalog?.chains.find((item) => item.label === label);
    if (!next || !catalog) return;
    if (next.id !== chain) {
      const stored = next.id === 'sol' ? solanaAccount : next.id === 'base' ? evmAccount : '';
      setRefundTo((current) => (isOriginAddress(next.id, current) ? current : stored));
    }
    setChain(next.id);
    const token = pickToken(catalog.tokens, next.id, origin?.symbol ?? 'USDC');
    setOriginAsset(token?.assetId ?? '');
    setDryQuote(null);
    setLiveQuote(null);
    setStatus(null);
    setError('');
  }

  function refundAddress(): string {
    return chain === 'near' ? recipient.trim().toLowerCase() : refundTo.trim();
  }

  function validate(): boolean {
    if (!origin || !destination) {
      setError('Tidepool has not listed a token for this route.');
      return false;
    }
    if (!parseFundingAmount(amount)) {
      setError('Enter an amount greater than zero.');
      return false;
    }
    if (!isNearTestnetAccount(recipient)) {
      setError('Enter a NEAR testnet account, such as name.testnet. Mainnet accounts are not accepted.');
      return false;
    }
    if (!isOriginAddress(chain, refundAddress())) {
      setError(chain === 'near'
        ? 'Enter a NEAR testnet account, such as name.testnet.'
        : `Enter the refund address on ${originTokens.length ? catalog?.chains.find((item) => item.id === chain)?.label : 'the source network'}.`);
      return false;
    }
    setError('');
    return true;
  }

  async function quote(dry: boolean) {
    if (!origin || !destination || !validate()) return;
    setBusy(true);
    setError('');
    try {
      const next = await requestFundingQuote({
        dry,
        originAsset: origin.assetId,
        destinationAsset: destination.assetId,
        amount,
        refundTo: refundAddress(),
        recipient: recipient.trim().toLowerCase(),
      });
      if (dry) {
        setDryQuote(next);
        setLiveQuote(null);
        setStatus(null);
        setOriginNote('');
        setSubmittedHash('');
        setFollowLive(true);
        setChecked(false);
        setStage(1);
      } else {
        if (!next.depositAddress) {
          setError('Tidepool did not return a deposit address. Nothing was sent.');
          return;
        }
        setLiveQuote(next);
        setFollowLive(true);
        setStage(2);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tidepool could not quote this route.');
    } finally {
      setBusy(false);
    }
  }

  async function approveDeposit() {
    if (!deposit || !store.accountId || !liveQuote?.depositAddress) return;
    setBusy(true);
    setError('');
    try {
      const outcome = await requestFundingSignature({ signerId: store.accountId, deposit });
      const hash = transactionHash(outcome);
      if (!hash) {
        setError('The wallet returned no transaction hash. Check status before assuming the deposit was seen. Nothing is marked successful.');
        return;
      }
      await finishOrigin('near', hash, liveQuote);
    } catch (reason) {
      setError(explainFundingError(reason));
    } finally {
      setBusy(false);
    }
  }

  function verifiedHash(blockchain: string, hash: string): VerifiedHash {
    return {
      hash,
      url: originExplorer(blockchain, hash),
      label: `${chainLabel(blockchain)} deposit`,
    };
  }

  async function finishOrigin(blockchain: string, hash: string, quote: PublicQuote) {
    if (!quote.depositAddress) return;
    setSubmittedHash(hash);
    setOriginNote(`Checking ${chainLabel(blockchain)}. A confirmed deposit is not a finished transfer.`);
    const load = () => {
      if (blockchain === 'sol') {
        return verifySolanaDeposit(hash, {
          depositAddress: quote.depositAddress ?? '',
          amount: quote.amountIn,
          mint: quote.contractAddress,
        });
      }
      if (blockchain === 'base') return verifyBaseDeposit(hash, quote);
      return verifyNearDeposit(hash, {
        signerId: store.accountId ?? '',
        receiverId: quote.contractAddress ?? '',
        amount: quote.amountIn,
        depositAddress: quote.depositAddress ?? '',
      });
    };
    const check = blockchain === 'near' ? await load() : await waitForOrigin(load);
    if (check.state !== 'confirmed') {
      setOriginNote('');
      setError(`${check.detail} Nothing is marked successful.`);
      return;
    }
    const note = `${chainLabel(blockchain)} confirmed this deposit transaction. Tidepool has not finished the transfer.`;
    setOriginNote(note);
    try {
      const next = await submitFundingDeposit({
        txHash: hash,
        depositAddress: quote.depositAddress,
        memo: quote.depositMemo,
        nearSenderAccount: blockchain === 'near' ? store.accountId : null,
      });
      setStatus(next);
      remember(quote, next, verifiedHash(blockchain, hash));
      setStage(3);
    } catch (reason) {
      setError(reason instanceof Error
        ? `${reason.message} The test network confirmation is not a finished transfer.`
        : 'Tidepool did not accept that hash. The test network confirmation is not a finished transfer.');
    }
  }

  function connectOrigin(kind: 'sol' | 'base', id: string, address: string) {
    if (kind === 'sol') {
      setSolanaWalletId(id);
      setSolanaAccount(address);
    } else {
      setEvmWalletId(id);
      setEvmAccount(address);
    }
    if (chain === kind) setRefundTo((current) => (current.trim() ? current : address));
  }

  function clearOrigin(kind: 'sol' | 'base') {
    if (kind === 'sol') {
      setSolanaWalletId('');
      setSolanaAccount('');
    } else {
      setEvmWalletId('');
      setEvmAccount('');
    }
  }

  async function approveSolana() {
    if (!liveQuote?.depositAddress || !origin || origin.assetId !== liveQuote.originAsset || !solanaAccount) return;
    setBusy(true);
    setError('');
    setOriginNote('Waiting for the Solana wallet. Nothing is confirmed yet.');
    try {
      const hash = await approveSolanaDeposit(solanaWalletId, {
        owner: solanaAccount,
        depositAddress: liveQuote.depositAddress,
        amount: liveQuote.amountIn,
        mint: liveQuote.contractAddress,
        decimals: origin.decimals,
      });
      await finishOrigin('sol', hash, liveQuote);
    } catch (reason) {
      setOriginNote('');
      setError(explainOriginError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function approveBase() {
    if (!liveQuote?.depositAddress || !evmAccount) return;
    setBusy(true);
    setError('');
    setOriginNote('Waiting for the Base Sepolia wallet. Nothing is confirmed yet.');
    try {
      const hash = await approveBaseDeposit(evmWalletId, { ...liveQuote, owner: evmAccount });
      await finishOrigin('base', hash, liveQuote);
    } catch (reason) {
      setOriginNote('');
      setError(explainOriginError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function submitHash() {
    if (!liveQuote?.depositAddress) return;
    if (!isDepositHash(hashDraft)) {
      setError('Enter the transaction hash from the wallet that sent the deposit.');
      return;
    }
    if (liveQuote.originBlockchain === 'sol' || liveQuote.originBlockchain === 'base') {
      setBusy(true);
      setError('');
      try {
        await finishOrigin(liveQuote.originBlockchain, hashDraft.trim(), liveQuote);
      } catch (reason) {
        setError(explainOriginError(reason));
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await submitFundingDeposit({
        txHash: hashDraft.trim(),
        depositAddress: liveQuote.depositAddress,
        memo: liveQuote.depositMemo,
      });
      setSubmittedHash(hashDraft.trim());
      setStatus(next);
      remember(liveQuote, next);
      setStage(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tidepool did not accept that hash.');
    } finally {
      setBusy(false);
    }
  }

  async function track() {
    if (!isDepositAddress(trackAddress)) {
      setError('Enter a Tidepool deposit address to check.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await loadFundingStatus(trackAddress.trim(), null);
      setFollowLive(false);
      setStatus(next);
      setStage(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tidepool has no status for that address.');
    } finally {
      setBusy(false);
    }
  }

  async function faucet() {
    setFaucetNote('');
    setError('');
    if (chain === 'near') {
      if (!isNearTestnetAccount(recipient)) {
        setError('Enter a NEAR testnet account before requesting test tokens.');
        return;
      }
    } else if (!isOriginAddress(chain, refundTo)) {
      setError('Enter the testnet address that should receive the faucet drip.');
      return;
    }
    setBusy(true);
    try {
      const detail = chain === 'near'
        ? await requestTestTokens({ accountId: recipient.trim().toLowerCase() })
        : await requestTestTokens({ chain, address: refundTo.trim() });
      setFaucetNote(`${detail} This does not mean a cross-chain transfer succeeded.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The faucet request was not accepted.');
    } finally {
      setBusy(false);
    }
  }

  const chainLabels = catalog?.chains.map((item) => item.label) ?? [];
  const selectedChainLabel = catalog?.chains.find((item) => item.id === chain)?.label ?? '';
  const rows = useMemo(() => (dryQuote ? quoteRows(dryQuote) : []), [dryQuote]);
  const broughtOver = Boolean(params.get('amount') || params.get('chain') || params.get('token'));
  const originPanel = chain === 'sol' || chain === 'base' ? (
    <OriginWallet
      chain={chain}
      account={chain === 'sol' ? solanaAccount : evmAccount}
      walletId={chain === 'sol' ? solanaWalletId : evmWalletId}
      disabled={busy}
      onAccount={(id, address) => connectOrigin(chain, id, address)}
      onClear={() => clearOrigin(chain)}
    />
  ) : null;

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Move Funds</h1>
          <p className="lede">Send test tokens to NEAR testnet through Tidepool. Tidepool is not affiliated with NEAR. Real-money transfers stay off.</p>
          <Capability ready="Quotes and status come from Tidepool" chain="No mainnet transfer" />
        </div>
        <Link to="/staking" className="btn btn-secondary">Staking is a separate step</Link>
      </div>
      {broughtOver ? <p className="hint">These details were brought over from the assistant. A quote is fetched only when you ask for one.</p> : null}

      <div className="split">
        <section className="card flow-card">
          <Stepper steps={steps} current={Math.min(stage, 3)} />
          {loadError ? <p className="warn-box" role="alert">{loadError}</p> : null}
          {!catalog && !loadError ? <p className="loading-line" role="status">Loading Tidepool testnet tokens…</p> : null}

          {stage === 0 && catalog ? (
            <>
              <ChoiceGroup label="Source network" value={selectedChainLabel} options={chainLabels} onChange={selectChain} />
              <ChoiceGroup
                label="Source token"
                value={origin?.symbol ?? ''}
                options={originTokens.map((token) => token.symbol)}
                onChange={(symbol) => {
                  const token = originTokens.find((item) => item.symbol === symbol);
                  if (token) setOriginAsset(token.assetId);
                  setError('');
                }}
              />
              <Field id="funding-destination-token" label="What arrives on NEAR testnet" hint="This is a Tidepool test token. It is not assumed to be native, stakeable NEAR.">
                <select
                  id="funding-destination-token"
                  value={destinationAsset}
                  onChange={(event) => setDestinationAsset(event.target.value)}
                >
                  {nearTokens.map((token) => (
                    <option key={token.assetId} value={token.assetId}>{token.symbol} test token</option>
                  ))}
                </select>
              </Field>
              <Field id="funding-amount" label="Amount" error={error && !parseFundingAmount(amount) ? error : undefined}>
                <input id="funding-amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} />
              </Field>
              <Field id="funding-destination" label="NEAR testnet account" hint="Use name.testnet. A mainnet name.near account is rejected." error={error && parseFundingAmount(amount) ? error : undefined}>
                <input
                  id="funding-destination"
                  value={recipient}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name.testnet"
                  onChange={(event) => { setRecipient(event.target.value); setError(''); }}
                  onBlur={() => setRecipient((value) => value.trim().toLowerCase())}
                />
              </Field>
              {chain !== 'near' ? (
                <Field id="funding-refund" label={`Refund address on ${selectedChainLabel}`} hint="A failed or leftover deposit returns here. Do not use a mainnet address.">
                  <input
                    id="funding-refund"
                    value={refundTo}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => { setRefundTo(event.target.value); setError(''); }}
                  />
                </Field>
              ) : null}
              {originPanel}
              <p className="hint">Received test wNEAR is the token wnear.tidepool-sandbox.testnet. Easy Staking spends native NEAR. This page does not unwrap or stake. Test wNEAR cannot be turned into native NEAR here.</p>
              {error && parseFundingAmount(amount) && isNearTestnetAccount(recipient) ? <p className="warn-box" role="alert">{error}</p> : null}
              <Button variant="primary" className="btn-block" disabled={busy} onClick={() => void quote(true)}>Get testnet quote</Button>
            </>
          ) : null}

          {stage === 1 && dryQuote ? (
            <>
              <RouteVisual
                fromSymbol={dryQuote.originSymbol}
                fromLabel={dryQuote.originLabel}
                fromAmount={`${dryQuote.amountInFormatted} ${dryQuote.originSymbol}`}
                toSymbol={dryQuote.destinationSymbol}
                toLabel={dryQuote.destinationLabel}
                toAmount={`${dryQuote.amountOutFormatted} ${dryQuote.destinationSymbol}`}
              />
              <TxTable rows={rows} />
              <p className="hint">Slippage tolerance sent with this quote: 1%. A dry quote does not create a deposit address and does not move tokens.</p>
              <p>Test wNEAR cannot be turned into native NEAR here, and it cannot be staked from this page. This page does not unwrap or stake it. Funding and staking stay separate. Native NEAR was not treated as a payout{catalog?.nativeNearAssetListed ? ', and a listed NEAR symbol is still not sent to a staking pool' : ''}.</p>
              {error ? <p className="warn-box" role="alert">{error}</p> : null}
              <label className="check">
                <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
                <span>I understand these are testnet tokens with no value. Preparing a deposit asks Tidepool for an address. It does not send funds.</span>
              </label>
              <div className="inline-actions">
                <Button onClick={() => setStage(0)}>Back</Button>
                <Button variant="primary" disabled={!checked || busy} onClick={() => void quote(false)}>Prepare deposit</Button>
              </div>
            </>
          ) : null}

          {stage === 2 && liveQuote?.depositAddress ? (
            <>
              <h2>Deposit is not sent yet</h2>
              <ul className="plain-steps">
                {depositLines(liveQuote).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <Field id="funding-deposit-address" label="Deposit address">
                <input id="funding-deposit-address" readOnly value={liveQuote.depositAddress} />
              </Field>
              {liveQuote.depositMemo ? (
                <Field id="funding-memo" label="Memo or destination tag">
                  <input id="funding-memo" readOnly value={liveQuote.depositMemo} />
                </Field>
              ) : null}
              <p className="hint">Expected output {liveQuote.amountOutFormatted} {liveQuote.destinationSymbol}. Expires {liveQuote.deadline ?? 'at the time in the quote'}.</p>
              {liveQuote.originBlockchain === 'sol' || liveQuote.originBlockchain === 'base' ? originPanel : null}
              {liveQuote.originBlockchain === 'sol' ? (
                solanaAccount ? (
                  <Button id="funding-approve" variant="primary" disabled={busy} onClick={() => void approveSolana()}>Approve test transfer</Button>
                ) : (
                  <p className="hint">Connect a Solana devnet wallet, or paste a devnet hash after you send the deposit yourself. Nothing is sent until you approve it.</p>
                )
              ) : null}
              {liveQuote.originBlockchain === 'base' ? (
                evmAccount ? (
                  <Button id="funding-approve" variant="primary" disabled={busy} onClick={() => void approveBase()}>Approve test transfer</Button>
                ) : (
                  <p className="hint">Connect a Base Sepolia wallet, or paste a Base Sepolia hash after you send the deposit yourself. Nothing is sent until you approve it.</p>
                )
              ) : null}
              {deposit ? (
                store.network !== 'testnet' ? (
                  <p className="warn-box">Your NEAR wallet is on mainnet. Switch to testnet before approving this test deposit. Switching disconnects the current account.</p>
                ) : canSign ? (
                  <Button id="funding-approve" variant="primary" disabled={busy} onClick={() => void approveDeposit()}>Approve deposit in wallet</Button>
                ) : (
                  <p className="hint">{store.sample ? 'The sample layout is not a wallet.' : 'Connect a NEAR testnet wallet to approve this token transfer.'} You can also send it yourself and paste the hash.</p>
                )
              ) : null}
              {liveQuote.originBlockchain !== 'sol' && liveQuote.originBlockchain !== 'base' && !deposit ? (
                <p className="hint">NEAR Easy cannot sign on {liveQuote.originLabel}. Approve the send in your own testnet wallet, then paste the hash.</p>
              ) : null}
              {originNote ? <p role="status">{originNote}</p> : null}
              {store.network !== 'testnet' && deposit ? (
                <Button onClick={() => void store.setNetwork('testnet')}>Use testnet</Button>
              ) : null}
              <Field id="funding-hash" label="Transaction hash" hint={liveQuote.originBlockchain === 'sol' || liveQuote.originBlockchain === 'base' ? 'Paste this only after your wallet has broadcast it. NEAR Easy checks it on the test network before telling Tidepool. A hash alone is not success.' : 'Paste this only after your wallet has broadcast it. A hash alone is not success.'}>
                <input id="funding-hash" value={hashDraft} autoCapitalize="none" spellCheck={false} onChange={(event) => setHashDraft(event.target.value)} />
              </Field>
              {error ? <p className="warn-box" role="alert">{error}</p> : null}
              <div className="inline-actions">
                <Button onClick={() => setStage(1)}>Back</Button>
                <Button disabled={busy} onClick={() => void submitHash()}>Submit this hash</Button>
                <Button variant="primary" disabled={busy} onClick={() => { setFollowLive(true); setStage(3); }}>Check status</Button>
              </div>
            </>
          ) : null}

          {stage === 3 ? (
            <StatusPanel
              status={status}
              error={error}
              submittedHash={submittedHash}
              originNote={originNote}
              onBack={() => setStage(liveQuote ? 2 : 0)}
            />
          ) : null}
        </section>

        <aside className="card side-note">
          <h2>Testnet only</h2>
          <p className="safety">Tidepool runs this test bridge. It is community-operated and not affiliated with NEAR. Do not send mainnet assets. NEAR Easy never asks for a seed phrase or a private key.</p>
          <Help title="What you are approving">
            <ol className="plain-steps">
              <li>The source network, token, and amount.</li>
              <li>The NEAR testnet account, character by character.</li>
              <li>The expected output, the quote’s value gap, and the expiration.</li>
              <li>The deposit address. Sign only in your own wallet. Solana devnet and Base Sepolia can open here. Mainnet is refused.</li>
            </ol>
          </Help>
          <p className="hint">Need test tokens? The Tidepool faucet can drip test USDC or USDT. Native SOL, ETH, BTC, and XRP are not dripped. This is optional and does not start a transfer.</p>
          <Button disabled={busy || !catalog} onClick={() => void faucet()}>Request test tokens</Button>
          {faucetNote ? <p role="status">{faucetNote}</p> : null}
          <Field id="funding-track" label="Track a deposit address" hint="Status is shown only from Tidepool’s response.">
            <input id="funding-track" value={trackAddress} autoCapitalize="none" spellCheck={false} onChange={(event) => setTrackAddress(event.target.value)} />
          </Field>
          <Button disabled={busy} onClick={() => void track()}>Check this address</Button>
          <button type="button" className="text-btn" onClick={store.openGlossary}>What do these words mean?</button>
        </aside>
      </div>
    </div>
  );
}

function StatusPanel({
  status,
  error,
  submittedHash,
  originNote,
  onBack,
}: {
  status: FundingStatus | null;
  error: string;
  submittedHash: string;
  originNote: string;
  onBack: () => void;
}) {
  if (!status) {
    return (
      <>
        <p className="loading-line" role="status" aria-busy="true">Checking Tidepool…</p>
        {error ? <p className="warn-box" role="alert">{error}</p> : null}
      </>
    );
  }
  const tone = status.status === 'SUCCESS' ? 'success' : status.status === 'REFUNDED' || status.status === 'FAILED' ? 'failure' : '';
  return (
    <div className={tone ? `result-panel ${tone}` : undefined}>
      <p className="eyebrow">Tidepool status</p>
      <h2>{status.label}</h2>
      <p>API status: {status.status}.{status.updatedAt ? ` Updated ${status.updatedAt}.` : ''}</p>
      {originNote ? <p>{originNote}</p> : null}
      {status.status === 'SUCCESS' ? <p>This success is the status Tidepool returned. It is not inferred from a hash or from the origin transaction alone.</p> : <p>An origin transaction, even after the test network confirms it, is not a finished transfer.</p>}
      {status.amountOutFormatted ? <p>Settled output in the status: {status.amountOutFormatted}.</p> : null}
      {status.refundReason ? <p>Refund reason: {status.refundReason}.</p> : null}
      {status.refundedAmountFormatted ? <p>Refunded amount in the status: {status.refundedAmountFormatted}.</p> : null}
      {submittedHash ? <p>Hash you submitted: {submittedHash}. That hash is not treated as success by itself.</p> : null}
      {status.hashes.length ? (
        <ul className="plain-steps">
          {status.hashes.map((hash) => (
            <li key={`${hash.label}-${hash.hash}`}>
              {hash.label}: {hash.hash}
              {hash.url ? <> · <a href={hash.url} target="_blank" rel="noreferrer">View on the testnet explorer</a></> : ' · Explorer link withheld. It was not a known testnet explorer.'}
            </li>
          ))}
        </ul>
      ) : <p>No verified transaction hash was included in this response.</p>}
      {error ? <p className="warn-box" role="alert">{error}</p> : null}
      {!status.terminal ? <p className="hint">Checking again every few seconds. Pending, processing, and a submitted hash are not success.</p> : null}
      <Button onClick={onBack}>Back</Button>
    </div>
  );
}
