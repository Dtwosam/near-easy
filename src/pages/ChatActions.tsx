import { useEffect, useState } from 'react';
import { loadFundingCatalog, loadFundingStatus, requestFundingQuote, submitFundingDeposit } from '../funding/client';
import { explainFundingError, requestFundingSignature } from '../funding/deposit';
import { approveBaseDeposit } from '../funding/evmWallet';
import { OriginWallet } from '../funding/OriginWallet';
import { explainOriginError, originExplorer, waitForOrigin } from '../funding/originPlan';
import { verifyBaseDeposit, verifyNearDeposit, verifySolanaDeposit } from '../funding/originRpc';
import {
  chainLabel,
  depositLines,
  isNearTestnetAccount,
  nearDepositAction,
  parseFundingAmount,
  pickToken,
  quotePreviewRows,
  saveFundingActivity,
  tokensOn,
} from '../funding/plan';
import type { FundingStatus, FundingToken, PublicQuote, VerifiedHash } from '../funding/plan';
import { approveSolanaDeposit } from '../funding/solanaWallet';
import { parseFundingAsk, parseFundingRecipient, parseStakeAsk, parseValidatorAsk, proposedFundingRecipient } from '../logic';
import { formatNear } from '../near/format';
import { chooseStakePool, loadStakePools } from '../near/stakeChain';
import type { StakePool } from '../near/stakeChain';
import {
  explorerTx,
  FEE_RESERVE_YOCTO,
  parseStakeAmount,
  saveStakeActivity,
  stakeableYocto,
  stakingEnabled,
  transactionHash,
} from '../near/stakePlan';
import { executeStake } from '../near/stakeSend';
import { nearLine } from '../near/present';
import { useStore } from '../store';
import { Badge, Button, Field, TxTable } from '../ui';

type StakeOutcome =
  | { kind: 'success'; hash: string; explorer: string; staked: string }
  | { kind: 'rejected' | 'failed' | 'network' | 'unconfirmed'; hash: string | null; message: string };

const SHOWN_VALIDATORS = 4;

function ValidatorPicker({
  pools,
  moreOpen,
  onMore,
  onSelect,
}: {
  pools: StakePool[];
  moreOpen: boolean;
  onMore: () => void;
  onSelect: (pool: StakePool) => void;
}) {
  const visible = moreOpen ? pools : pools.slice(0, SHOWN_VALIDATORS);
  const hidden = Math.max(0, pools.length - SHOWN_VALIDATORS);
  return (
    <div id="chat-validator-picker">
      <h2>Which validator do you want to use?</h2>
      <p className="hint">Nothing is selected until you choose. Commission is read from the pool.</p>
      <div className="validator-options">
        {visible.map((item) => (
          <button key={item.id} type="button" className="validator-option" data-pool-id={item.id} onClick={() => onSelect(item)}>
            <strong>{item.label}</strong>
            <span>Commission {item.commission}</span>
            <span className="hint">Fee fraction {item.fraction} · Pool stake {item.poolStake}</span>
            <span className="hint">{item.staking === 'open' ? 'Staking was open when this pool was read.' : 'Pause status was unread.'}</span>
            <span className="validator-id">{item.id}</span>
          </button>
        ))}
      </div>
      <div className="inline-actions">
        {hidden > 0 ? (
          <Button id="chat-validators-more" aria-expanded={moreOpen} onClick={onMore}>
            {moreOpen ? 'Show fewer validators' : 'Other validators'}
          </Button>
        ) : null}
        <a
          id={hidden > 0 ? undefined : 'chat-validators-more'}
          className="btn btn-secondary"
          href="https://testnet.nearblocks.io/validators"
          target="_blank"
          rel="noreferrer"
        >
          {hidden > 0 ? 'Public testnet validator list' : 'Other validators'}
        </a>
      </div>
      <details className="help">
        <summary>How these pools were read</summary>
        <div className="help-body">
          <p>These pools were read from NEAR testnet. Commission, fee fraction, and pool stake come from each pool contract. A reward rate is not estimated. Pause status appears only when the pool returned it.</p>
          {moreOpen && hidden > 0 ? <p>Showing {pools.length} pools with a readable commission. The public list has more.</p> : null}
          {!moreOpen && hidden > 0 ? <p>{hidden} more readable pools stay hidden until you choose Other validators.</p> : null}
          {hidden === 0 ? <p>These are the pools whose commission could be read. Other validators opens the public testnet list.</p> : null}
        </div>
      </details>
    </div>
  );
}

export function ChatStake({ prompt }: { prompt: string }) {
  const store = useStore();
  const promptAmount = parseStakeAsk(prompt);
  const [typedAmount, setTypedAmount] = useState('');
  const amount = promptAmount ?? typedAmount;
  const preference = parseValidatorAsk(prompt);
  const enabled = stakingEnabled(store.network);
  const [pools, setPools] = useState<StakePool[]>([]);
  const [poolsError, setPoolsError] = useState('');
  const [loadingPools, setLoadingPools] = useState(false);
  const [pool, setPool] = useState<StakePool | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [missingPreference, setMissingPreference] = useState(false);
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<StakeOutcome | null>(null);
  const requested = parseStakeAmount(amount);
  const stakeable = store.balance.kind === 'live' && store.balance.availableYocto
    ? stakeableYocto(BigInt(store.balance.availableYocto))
    : null;
  const tooLarge = requested != null && stakeable != null && requested > stakeable;

  useEffect(() => {
    if (!enabled) {
      setPools([]);
      setPool(null);
      setMoreOpen(false);
      setChecked(false);
      setMissingPreference(false);
      setLoadingPools(false);
      setPoolsError('');
      return;
    }
    let cancelled = false;
    setLoadingPools(true);
    setPoolsError('');
    setPool(null);
    setMoreOpen(false);
    setChecked(false);
    setMissingPreference(false);
    loadStakePools('testnet')
      .then((next) => {
        if (cancelled) return;
        setPools(next);
        const chosen = preference ? chooseStakePool(next, preference) : null;
        setPool(chosen);
        setMissingPreference(Boolean(preference) && !chosen);
        if (!next.length) setPoolsError('No staking pool with a readable commission was returned.');
        setLoadingPools(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadingPools(false);
        setPoolsError('Validator information could not be read. Nothing was prepared.');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, preference]);

  function selectPool(next: StakePool) {
    setPool(next);
    setChecked(false);
    setResult(null);
  }

  async function approve() {
    if (sending || !checked || !pool || !store.accountId || !enabled || !requested || stakeable == null || requested > stakeable) return;
    setSending(true);
    setResult(null);
    try {
      const confirmed = await executeStake({
        network: 'testnet',
        signerId: store.accountId,
        poolId: pool.id,
        amountYocto: requested,
      });
      if (!confirmed.ok) {
        setResult({ kind: confirmed.kind, hash: confirmed.hash, message: confirmed.message });
        return;
      }
      saveStakeActivity({
        hash: confirmed.hash,
        accountId: store.accountId,
        network: 'testnet',
        poolId: pool.id,
        amount,
        commission: pool.commission,
        when: new Date().toISOString(),
      });
      store.refreshHoldings();
      setResult({
        kind: 'success',
        hash: confirmed.hash,
        explorer: explorerTx('testnet', confirmed.hash),
        staked: formatNear(confirmed.stakedYocto),
      });
    } catch {
      setResult({ kind: 'failed', hash: null, message: 'The stake could not be submitted. Nothing was confirmed.' });
    } finally {
      setSending(false);
    }
  }

  const ready = enabled
    && store.balance.kind === 'live'
    && !store.balance.loading
    && Boolean(store.accountId)
    && Boolean(pool)
    && requested != null
    && !tooLarge
    && !missingPreference;
  const askForValidator = enabled && !preference && !pool && !loadingPools && !poolsError && pools.length > 0 && result?.kind !== 'success';

  const stakeStatus = result?.kind === 'success' ? 'Confirmed on NEAR' : 'Not submitted';
  const stakeRows = enabled && pool && !missingPreference && requested != null
    ? [
        { label: 'Amount', value: `${amount} NEAR` },
        { label: 'Validator', value: pool.label, hint: preference ? 'This matches the validator you named.' : 'You selected this validator.' },
        { label: 'Commission', value: `${pool.commission} (${pool.fraction}), read from the pool` },
        { label: 'Network', value: 'NEAR testnet' },
        { label: 'Account', value: store.accountId ?? 'Not connected' },
        { label: 'Available', value: store.balance.kind === 'live' ? nearLine(store.balance, 'available') : 'Unknown' },
        { label: 'Most that can be staked', value: stakeable == null ? 'Unknown until the balance is read' : `${formatNear(stakeable)} NEAR` },
        { label: 'Kept for the fee', value: `${formatNear(FEE_RESERVE_YOCTO)} NEAR`, hint: 'Left liquid so the account can pay gas. Storage rent is already excluded.' },
        { label: 'NEAR Easy fee', value: 'None' },
        { label: 'Status', value: stakeStatus },
      ]
    : [];
  const stakeDetailRows = enabled && pool && !missingPreference && requested != null
    ? [
        { label: 'Pool account', value: pool.id },
        { label: 'Pool stake', value: pool.poolStake },
        { label: 'Staking', value: pool.staking === 'open' ? 'Open when the pool was read' : 'Pause status was unread' },
        { label: 'Attached gas', value: '300 TGas. Unused gas returns to the account.' },
        { label: 'Action', value: 'deposit_and_stake' },
      ]
    : [];

  return (
    <div className="flow" id="chat-stake">
      <div className="flow-body">
        <p className="eyebrow">
          <Badge tone="accent">Available (Testnet)</Badge> Stake preview
        </p>
        <p>{enabled ? 'Nothing is signed until you approve it.' : 'Mainnet staking is not enabled.'}</p>
        {!enabled ? <p className="warn-box">Mainnet staking is not enabled. Nothing was submitted.</p> : null}
        {enabled && store.balance.kind === 'sample' ? <p className="warn-box">The sample layout is not a wallet. Connect a testnet account before staking.</p> : null}
        {enabled && store.balance.kind === 'empty' ? <p>Connect a NEAR testnet wallet so the available balance can be checked.</p> : null}
        {enabled && store.balance.kind === 'live' && store.balance.loading && !store.balance.available ? <p className="loading-line" role="status">Reading the available balance…</p> : null}
        {enabled && store.balance.kind === 'live' && !store.balance.loading && !store.balance.availableYocto ? <p className="warn-box">The available balance could not be read. Nothing was prepared.</p> : null}
        {!promptAmount ? (
          <Field id="chat-stake-amount" label="Stake amount (NEAR)" hint="The preview uses this amount. Nothing is signed until you approve it.">
            <input
              id="chat-stake-amount"
              inputMode="decimal"
              value={typedAmount}
              onChange={(event) => {
                setTypedAmount(event.target.value);
                setChecked(false);
              }}
            />
          </Field>
        ) : null}
        {loadingPools ? <p className="loading-line" role="status">Reading validator commissions…</p> : null}
        {poolsError ? <p className="warn-box" role="alert">{poolsError}</p> : null}
        {missingPreference ? <p className="warn-box">No readable pool matched {preference}. Nothing was prepared.</p> : null}
        {askForValidator ? (
          <ValidatorPicker
            pools={pools}
            moreOpen={moreOpen}
            onMore={() => setMoreOpen((open) => !open)}
            onSelect={selectPool}
          />
        ) : null}
        {enabled && pool && !missingPreference && requested == null ? <p className="hint">Enter an amount to prepare the preview.</p> : null}
        {stakeRows.length ? <TxTable rows={stakeRows} /> : null}
        {stakeDetailRows.length ? (
          <details className="help">
            <summary>Technical details</summary>
            <div className="help-body">
              <TxTable rows={stakeDetailRows} />
            </div>
          </details>
        ) : null}
        {tooLarge ? (
          <p className="warn-box" role="alert">
            That leaves less than {formatNear(FEE_RESERVE_YOCTO)} NEAR for the transaction fee. The most you can stake is {stakeable == null ? 'unknown' : `${formatNear(stakeable)} NEAR`}. Nothing was submitted.
          </p>
        ) : null}
        {result?.kind === 'success' ? (
          <div id="chat-stake-result">
            <h2>Stake confirmed</h2>
            <p>{amount} NEAR was delegated to {pool?.label ?? 'the pool'}. The pool now reports {result.staked} NEAR staked for this account. Activity includes this stake.</p>
            <details className="help">
              <summary>Transaction hash</summary>
              <div className="help-body">
                <p className="mono">{result.hash}</p>
              </div>
            </details>
          </div>
        ) : null}
        {result && result.kind !== 'success' ? (
          <div id="chat-stake-result">
            <h2>{result.kind === 'rejected' ? 'Stake declined' : result.kind === 'failed' ? 'Stake failed' : 'Stake not confirmed'}</h2>
            <p>{result.message}</p>
            {result.hash ? (
              <details className="help">
                <summary>Transaction hash</summary>
                <div className="help-body">
                  <p className="mono">{result.hash}</p>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
        {sending ? <p className="loading-line" role="status">Waiting for your wallet, then for NEAR to confirm the transaction…</p> : null}
        <details className="help">
          <summary>About this preview</summary>
          <div className="help-body">
            <p>The reply does not set the amount, the validator, or the fee. {pool ? 'This preview uses the connected wallet and the pool contract.' : 'Choose a validator before a preview is prepared.'} {missingPreference ? 'The named validator was not replaced.' : ''}</p>
          </div>
        </details>
      </div>
      <div className="action-dock">
        <p className="dock-summary">
          {pool && requested != null
            ? `${amount} NEAR to ${pool.label}. ${stakeStatus}.`
            : 'Choose a validator and an amount. Nothing is signed yet.'}
        </p>
        {result?.kind === 'success' ? (
          <a className="btn btn-secondary" href={result.explorer} target="_blank" rel="noreferrer">View on the explorer</a>
        ) : (
          <>
            {ready ? (
              <label className="check">
                <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={sending} />
                <span>I want to stake this NEAR. My wallet must approve it.</span>
              </label>
            ) : null}
            <div className="inline-actions">
              {enabled && store.balance.kind === 'empty' ? <Button variant="primary" onClick={store.openConnect}>Connect a NEAR wallet</Button> : null}
              {!enabled ? <Button variant="primary" onClick={() => void store.setNetwork('testnet')}>Use testnet</Button> : null}
              {enabled && pool && !preference ? (
                <Button onClick={() => { setPool(null); setChecked(false); setResult(null); }}>Choose a different validator</Button>
              ) : null}
              {ready ? (
                <Button id="chat-stake-approve" variant="primary" disabled={!checked || sending} onClick={() => void approve()}>
                  Approve in wallet
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function rememberFunding(quote: PublicQuote, next: FundingStatus, extra?: VerifiedHash) {
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

export function ChatFunding({ prompt, separateStake }: { prompt: string; separateStake: boolean }) {
  const store = useStore();
  const parsed = parseFundingAsk(prompt);
  const namedRecipient = parseFundingRecipient(prompt);
  const connectedRecipient = proposedFundingRecipient(null, store.network, store.accountId);
  const proposedRecipient = proposedFundingRecipient(namedRecipient, store.network, store.accountId);
  const [typedAmount, setTypedAmount] = useState('');
  const [customDestination, setCustomDestination] = useState<string | null>(null);
  const quoteAmount = parsed.amountWasNamed ? parsed.amount : parseFundingAmount(typedAmount) ?? '';
  const recipient = (customDestination !== null ? customDestination : proposedRecipient).trim().toLowerCase();
  const editingDestination = customDestination !== null || (!namedRecipient && !connectedRecipient);
  const [solanaWalletId, setSolanaWalletId] = useState('');
  const [solanaAccount, setSolanaAccount] = useState('');
  const [evmWalletId, setEvmWalletId] = useState('');
  const [evmAccount, setEvmAccount] = useState('');
  const [origin, setOrigin] = useState<FundingToken | null>(null);
  const [destination, setDestination] = useState<FundingToken | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [dryQuote, setDryQuote] = useState<PublicQuote | null>(null);
  const [liveQuote, setLiveQuote] = useState<PublicQuote | null>(null);
  const [status, setStatus] = useState<FundingStatus | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [approveChecked, setApproveChecked] = useState(false);
  const signable = parsed.chain === 'sol' || parsed.chain === 'base' || parsed.chain === 'near';
  const refund = parsed.chain === 'near'
    ? recipient
    : parsed.chain === 'sol'
      ? solanaAccount
      : parsed.chain === 'base'
        ? evmAccount
        : '';

  useEffect(() => {
    if (!signable) return;
    const controller = new AbortController();
    void loadFundingCatalog(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return;
        const source = tokensOn(catalog.tokens, parsed.chain).find((token) => token.symbol.toLowerCase() === parsed.token.toLowerCase()) ?? null;
        const destinationSymbol = parsed.tokenWasNamed ? parsed.token : 'wNEAR';
        const near = pickToken(catalog.tokens, 'near', destinationSymbol);
        const arrived = near && near.symbol.toLowerCase() === destinationSymbol.toLowerCase() ? near : null;
        if (!source) setCatalogError(`Tidepool has not listed ${parsed.token} on ${chainLabel(parsed.chain)}. Nothing was quoted.`);
        else if (!arrived) setCatalogError(`Tidepool has not listed ${destinationSymbol} on NEAR testnet. Nothing was quoted.`);
        setOrigin(source);
        setDestination(arrived);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setCatalogError(reason instanceof Error ? reason.message : 'Tidepool tokens could not be loaded.');
      });
    return () => controller.abort();
  }, [parsed.chain, parsed.token, parsed.tokenWasNamed, signable]);

  useEffect(() => {
    setLiveQuote(null);
    setDryQuote(null);
    setStatus(null);
    setChecked(false);
    setApproveChecked(false);
    setNote('');
  }, [quoteAmount, recipient, refund]);

  useEffect(() => {
    if (!quoteAmount || !origin || !destination || !isNearTestnetAccount(recipient) || !refund || liveQuote) return;
    const controller = new AbortController();
    setDryQuote(null);
    setError('');
    setBusy(true);
    void requestFundingQuote({
      dry: true,
      originAsset: origin.assetId,
      destinationAsset: destination.assetId,
      amount: quoteAmount,
      refundTo: refund,
      recipient,
    }, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setDryQuote(next);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Tidepool could not quote this route.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [destination, liveQuote, origin, quoteAmount, recipient, refund]);

  const pollDeposit = liveQuote?.depositAddress && status && !status.terminal ? liveQuote.depositAddress : '';
  useEffect(() => {
    if (!pollDeposit || !liveQuote) return;
    let stop = false;
    let timer = 0;
    const quote = liveQuote;
    async function tick() {
      try {
        const next = await loadFundingStatus(pollDeposit, quote.depositMemo);
        if (stop) return;
        setStatus(next);
        rememberFunding(quote, next);
        if (next.terminal) {
          setNote('');
          return;
        }
        timer = window.setTimeout(() => void tick(), 4000);
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
  }, [liveQuote, pollDeposit]);

  async function prepare() {
    if (!origin || !destination || !dryQuote || busy || !quoteAmount) return;
    setBusy(true);
    setError('');
    try {
      const next = await requestFundingQuote({
        dry: false,
        originAsset: origin.assetId,
        destinationAsset: destination.assetId,
        amount: quoteAmount,
        refundTo: refund,
        recipient,
      });
      if (!next.depositAddress) {
        setError('Tidepool did not return a deposit address. Nothing was sent.');
        return;
      }
      setLiveQuote(next);
      setApproveChecked(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tidepool could not prepare this deposit.');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!liveQuote?.depositAddress || !origin || busy || !approveChecked) return;
    setBusy(true);
    setError('');
    setNote('Waiting for the wallet. Nothing is confirmed yet.');
    try {
      let hash = '';
      if (liveQuote.originBlockchain === 'sol') {
        hash = await approveSolanaDeposit(solanaWalletId, {
          owner: solanaAccount,
          depositAddress: liveQuote.depositAddress,
          amount: liveQuote.amountIn,
          mint: liveQuote.contractAddress,
          decimals: origin.decimals,
        });
      } else if (liveQuote.originBlockchain === 'base') {
        hash = await approveBaseDeposit(evmWalletId, { ...liveQuote, owner: evmAccount });
      } else {
        const deposit = nearDepositAction(liveQuote);
        if (!deposit || !store.accountId || store.network !== 'testnet') {
          setNote('');
          setError('Connect a NEAR testnet wallet before approving this deposit. Nothing was sent.');
          return;
        }
        const outcome = await requestFundingSignature({ signerId: store.accountId, deposit });
        hash = transactionHash(outcome) ?? '';
        if (!hash) {
          setNote('');
          setError('The wallet returned no transaction hash. Nothing is marked successful.');
          return;
        }
      }
      setNote(`${chainLabel(liveQuote.originBlockchain)} is being checked. A confirmed deposit is not a finished transfer.`);
      const load = () => {
        if (liveQuote.originBlockchain === 'sol') {
          return verifySolanaDeposit(hash, {
            depositAddress: liveQuote.depositAddress ?? '',
            amount: liveQuote.amountIn,
            mint: liveQuote.contractAddress,
          });
        }
        if (liveQuote.originBlockchain === 'base') return verifyBaseDeposit(hash, liveQuote);
        return verifyNearDeposit(hash, {
          signerId: store.accountId ?? '',
          receiverId: liveQuote.contractAddress ?? '',
          amount: liveQuote.amountIn,
          depositAddress: liveQuote.depositAddress ?? '',
        });
      };
      const check = liveQuote.originBlockchain === 'near' ? await load() : await waitForOrigin(load);
      if (check.state !== 'confirmed') {
        setNote('');
        setError(`${check.detail} Nothing is marked successful.`);
        return;
      }
      setNote(`${chainLabel(liveQuote.originBlockchain)} confirmed this deposit transaction. Tidepool has not finished the transfer.`);
      const next = await submitFundingDeposit({
        txHash: hash,
        depositAddress: liveQuote.depositAddress,
        memo: liveQuote.depositMemo,
        nearSenderAccount: liveQuote.originBlockchain === 'near' ? store.accountId : null,
      });
      const submitted: VerifiedHash = {
        hash,
        url: originExplorer(liveQuote.originBlockchain, hash),
        label: `${chainLabel(liveQuote.originBlockchain)} deposit`,
      };
      setStatus(next);
      rememberFunding(liveQuote, next, submitted);
      if (next.terminal) setNote('');
    } catch (reason) {
      setNote('');
      const funding = liveQuote.originBlockchain === 'near';
      setError(funding ? explainFundingError(reason) : explainOriginError(reason));
    } finally {
      setBusy(false);
    }
  }

  const quote = liveQuote ?? dryQuote;
  const showWallet = parsed.chain === 'sol' || parsed.chain === 'base';
  const quoteRows = quote ? quotePreviewRows(quote) : [];
  const essentialQuoteLabels = new Set(['Source', 'Amount in', 'Expected output', 'Minimum output', 'Withdraw fee', 'NEAR Easy fee', 'Network', 'Recipient']);
  const essentialQuoteRows = quoteRows.filter((row) => essentialQuoteLabels.has(row.label)).map(({ label, value }) => ({ label, value }));
  const detailQuoteRows = quoteRows.filter((row) => !essentialQuoteLabels.has(row.label));
  const fundSummary = status?.status === 'SUCCESS'
    ? `Tidepool reported SUCCESS.${status.amountOutFormatted ? ` Settled amount ${status.amountOutFormatted}.` : ''}`
    : quote
      ? `${quote.amountInFormatted} ${quote.originSymbol} to ${quote.recipient}. ${liveQuote ? 'Deposit is not sent yet.' : 'Dry quote only. Nothing is sent.'}`
      : quoteAmount
        ? `${quoteAmount} ${parsed.token}. A quote waits for a destination and a source wallet.`
        : 'Enter an amount. Nothing is quoted yet.';

  return (
    <div className="flow" id="funding-handoff">
      <div className="flow-body">
      <p className="eyebrow">
        <Badge tone="accent">Available (Testnet)</Badge> Tidepool quote
      </p>
      <p>Nothing is sent until you approve it.</p>
      {!parsed.chainWasNamed ? <p className="hint">Source network: Solana devnet.</p> : null}
      {!parsed.tokenWasNamed || destination?.symbol === 'wNEAR' ? <p className="hint">Test wNEAR cannot be staked or unwrapped.</p> : null}
      {separateStake ? <p className="hint">Staking is a separate step.</p> : null}
      {!signable ? <p className="hint">This chain is not approved in this panel.</p> : null}
      {catalogError ? <p className="warn-box" role="alert">{catalogError}</p> : null}
      {!parsed.amountWasNamed ? (
        <Field id="chat-fund-amount" label="Amount">
          <input
            id="chat-fund-amount"
            inputMode="decimal"
            value={typedAmount}
            onChange={(event) => setTypedAmount(event.target.value)}
          />
        </Field>
      ) : null}
      {namedRecipient && customDestination === null ? <p id="chat-fund-destination">Destination {namedRecipient}.</p> : null}
      {!namedRecipient && connectedRecipient && customDestination === null ? (
        <p id="chat-fund-destination">I'll send this to your connected NEAR wallet: {connectedRecipient}.</p>
      ) : null}
      {!namedRecipient && !connectedRecipient && customDestination === null ? (
        <p id="chat-fund-destination">Connect a NEAR testnet wallet to use it as the destination, or enter an account.</p>
      ) : null}
      {store.network !== 'testnet' && !namedRecipient ? <p className="hint">A mainnet account is not used as the destination.</p> : null}
      {editingDestination ? (
        <Field id="chat-fund-recipient" label="NEAR testnet account">
          <input
            id="chat-fund-recipient"
            value={customDestination ?? ''}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name.testnet"
            onChange={(event) => setCustomDestination(event.target.value)}
          />
        </Field>
      ) : (
        <button type="button" className="text-btn" id="chat-fund-change-destination" onClick={() => setCustomDestination(recipient)}>
          Change destination
        </button>
      )}
      {customDestination !== null && proposedRecipient ? (
        <button type="button" className="text-btn" onClick={() => setCustomDestination(null)}>
          Use {namedRecipient ? namedRecipient : `connected wallet ${connectedRecipient}`}
        </button>
      ) : null}
      {customDestination !== null && recipient && !isNearTestnetAccount(recipient) ? (
        <p className="field-error">Use a name.testnet account. A mainnet account is not accepted.</p>
      ) : null}
      {customDestination !== null && isNearTestnetAccount(recipient) ? <p>Destination {recipient}.</p> : null}
      {showWallet ? (
        <OriginWallet
          compact
          chain={parsed.chain === 'base' ? 'base' : 'sol'}
          account={parsed.chain === 'base' ? evmAccount : solanaAccount}
          walletId={parsed.chain === 'base' ? evmWalletId : solanaWalletId}
          disabled={busy}
          onAccount={(id, address) => {
            if (parsed.chain === 'base') {
              setEvmWalletId(id);
              setEvmAccount(address);
            } else {
              setSolanaWalletId(id);
              setSolanaAccount(address);
            }
            setDryQuote(null);
            setChecked(false);
          }}
          onClear={() => {
            if (parsed.chain === 'base') {
              setEvmWalletId('');
              setEvmAccount('');
            } else {
              setSolanaWalletId('');
              setSolanaAccount('');
            }
          }}
        />
      ) : null}
      {busy && !quote && !liveQuote ? <p className="loading-line" role="status">Asking Tidepool for a testnet quote…</p> : null}
      {essentialQuoteRows.length ? <TxTable rows={essentialQuoteRows} /> : null}
      {detailQuoteRows.length ? (
        <details className="help">
          <summary>Quote details</summary>
          <div className="help-body">
            <TxTable rows={detailQuoteRows} />
          </div>
        </details>
      ) : null}
      {liveQuote?.depositAddress && status?.status !== 'SUCCESS' ? (
        <>
          <h2>Deposit is not sent yet</h2>
          <p className="mono">{liveQuote.depositAddress}</p>
          <details className="help">
            <summary>Deposit steps</summary>
            <div className="help-body">
              <ul className="plain-steps">
                {depositLines(liveQuote).map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </details>
        </>
      ) : null}
      {note && !(status && status.terminal) ? <p role="status">{note}</p> : null}
      {status?.status === 'SUCCESS' ? (
        <div className="result-panel success" id="chat-fund-complete">
          <p className="eyebrow">Tidepool status</p>
          <h2>Completed</h2>
          <p>Tidepool reported SUCCESS.</p>
          {status.amountOutFormatted
            ? <p>Settled amount: {status.amountOutFormatted}.</p>
            : <p>The status did not include a settled amount.</p>}
          {status.hashes.length ? (
            <div className="inline-actions">
              {status.hashes.map((item) => item.url ? (
                <a key={`${item.label}-${item.hash}`} className="btn btn-secondary" href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
              ) : (
                <span key={item.hash} className="mono">{item.hash}</span>
              ))}
            </div>
          ) : null}
          {status.hashes.length ? (
            <details className="help">
              <summary>Transaction hashes</summary>
              <div className="help-body">
                {status.hashes.map((item) => <p key={item.hash} className="mono">{item.hash}</p>)}
              </div>
            </details>
          ) : null}
        </div>
      ) : status ? (
        <div className={status.terminal ? 'result-panel failure' : undefined}>
          <p className="eyebrow">Tidepool status</p>
          <h2>{status.label}</h2>
          <p>API status: {status.status}.{status.updatedAt ? ` Updated ${status.updatedAt}.` : ''}</p>
          <p>An origin transaction, even after the test network confirms it, is not a finished transfer.</p>
          {status.amountOutFormatted ? <p>Settled output in the status: {status.amountOutFormatted}.</p> : null}
          {status.hashes.length ? (
            <details className="help">
              <summary>Transaction hashes</summary>
              <div className="help-body">
                {status.hashes.map((item) => <p key={item.hash} className="mono">{item.hash}</p>)}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="warn-box" role="alert">{error}</p> : null}
      <details className="help">
        <summary>About this quote</summary>
        <div className="help-body">
          <p>Figures come from Tidepool. A transfer is finished only when Tidepool reports SUCCESS.</p>
          {!parsed.chainWasNamed ? <p>The network was not named, so Solana devnet is selected.</p> : null}
          {!parsed.tokenWasNamed ? <p>The token was not named, so the quote uses test USDC in and test wNEAR out. Test wNEAR cannot be staked as native NEAR.</p> : null}
          {destination?.symbol === 'wNEAR' ? <p>Test wNEAR cannot be turned into native NEAR here, and this quote does not stake it.</p> : null}
          {separateStake ? <p>Staking is a separate step. This request does not stake the bridged token.</p> : null}
          {!signable ? <p>{chainLabel(parsed.chain)} is not approved in this panel. This panel approves Solana devnet, Base Sepolia, or a NEAR testnet deposit.</p> : null}
          <p>Use name.testnet. A mainnet account is not accepted.</p>
          <p>Connect the source wallet before Tidepool is asked for a quote. Nothing is sent.</p>
          <p>Tidepool is asked after you enter an amount. Nothing is sent until you approve a prepared deposit in your wallet.</p>
          <p>The reply does not set the amount, the fee, or the received amount. Real-money transfers stay off.</p>
        </div>
      </details>
      </div>
      <div className="action-dock">
        <p className="dock-summary">{fundSummary}</p>
        {!liveQuote && dryQuote ? (
          <label className="check">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={busy} />
            <span>I want this deposit prepared for {recipient}. Tidepool will be asked for an address. It does not send funds.</span>
          </label>
        ) : null}
        {liveQuote && !status?.terminal ? (
          <label className="check">
            <input type="checkbox" checked={approveChecked} onChange={(event) => setApproveChecked(event.target.checked)} disabled={busy} />
            <span>I want to send this test transfer. My wallet must approve it.</span>
          </label>
        ) : null}
        <div className="inline-actions">
          {!liveQuote && dryQuote ? (
            <Button id="chat-fund-prepare" variant="primary" disabled={!checked || busy} onClick={() => void prepare()}>Prepare deposit</Button>
          ) : null}
          {liveQuote && !status?.terminal ? (
            <Button
              id="chat-fund-approve"
              variant="primary"
              disabled={!approveChecked || busy || (parsed.chain === 'sol' ? !solanaAccount : parsed.chain === 'base' ? !evmAccount : store.network !== 'testnet' || !store.accountId)}
              onClick={() => void approve()}
            >
              Approve in wallet
            </Button>
          ) : null}
          {(parsed.chain === 'near' || !namedRecipient) && store.network !== 'testnet' ? (
            <Button onClick={() => void store.setNetwork('testnet')}>Use testnet</Button>
          ) : null}
          {!connectedRecipient ? <Button id="chat-fund-connect" variant="primary" onClick={store.openConnect}>Connect a NEAR wallet</Button> : null}
        </div>
      </div>
    </div>
  );
}
