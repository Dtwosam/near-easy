import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sampleWallet } from '../data';
import { parseAmount, parseStakeAsk } from '../logic';
import { formatNear } from '../near/format';
import { confirmStake, loadStakePools, readAccountStaked } from '../near/stakeChain';
import type { StakePool } from '../near/stakeChain';
import {
  explorerAccount,
  explorerTx,
  explainStakeError,
  FEE_RESERVE_YOCTO,
  parseStakeAmount,
  saveStakeActivity,
  stakeableYocto,
  stakingEnabled,
  transactionHash,
} from '../near/stakePlan';
import { requestStakeSignature } from '../near/stakeSend';
import { nearLine } from '../near/present';
import { useStore } from '../store';
import { Badge, Button, Capability, Field, Help, Stepper, TxTable, useTitle } from '../ui';

const steps = ['Amount', 'Review', 'Approve', 'Result'];

type StakeResult =
  | { kind: 'success'; hash: string; explorer: string; staked: string }
  | { kind: 'rejected' | 'failed' | 'network' | 'unconfirmed'; hash: string | null; message: string };

export function StakingPage() {
  useTitle('Easy Staking');
  const store = useStore();
  const [params] = useSearchParams();
  const amountParam = params.get('amount');
  const [amount, setAmount] = useState(() => (amountParam && parseAmount(amountParam) ? amountParam : ''));
  const [pools, setPools] = useState<StakePool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [poolsError, setPoolsError] = useState('');
  const [validatorId, setValidatorId] = useState('');
  const [stage, setStage] = useState(0);
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StakeResult | null>(null);
  const validator = pools.find((item) => item.id === validatorId) ?? null;
  const enabled = stakingEnabled(store.network);
  const stakeable = store.balance.kind === 'live' && store.balance.availableYocto
    ? stakeableYocto(BigInt(store.balance.availableYocto))
    : null;

  useEffect(() => {
    if (amountParam && parseStakeAsk(`stake ${amountParam} NEAR`)) {
      setAmount(amountParam);
      setStage(0);
      setChecked(false);
      setResult(null);
      setError('');
    }
  }, [amountParam]);

  useEffect(() => {
    let cancelled = false;
    setPoolsLoading(true);
    setPoolsError('');
    setPools([]);
    setStage(0);
    setChecked(false);
    setResult(null);
    loadStakePools(store.network)
      .then((next) => {
        if (cancelled) return;
        setPools(next);
        setPoolsLoading(false);
        if (!next.length) setPoolsError('No staking pool with a readable commission was returned for this network.');
      })
      .catch(() => {
        if (cancelled) return;
        setPoolsLoading(false);
        setPoolsError('Validator information could not be read. Staking stays unavailable until the network answers.');
      });
    return () => {
      cancelled = true;
    };
  }, [store.network]);

  useEffect(() => {
    if (!pools.length) return;
    const requested = params.get('validator');
    if (requested && pools.some((pool) => pool.id === requested)) {
      setValidatorId(requested);
      return;
    }
    setValidatorId((current) => (pools.some((pool) => pool.id === current) ? current : pools[0].id));
  }, [pools, params]);

  function review() {
    if (!parseStakeAmount(amount)) {
      setError('Enter a stake amount greater than zero.');
      return;
    }
    if (!validator) {
      setError(poolsError || 'Choose a validator whose commission was read from the network.');
      return;
    }
    if (store.balance.kind === 'sample') {
      setError('The sample layout is not a wallet. Connect a testnet account before staking.');
      return;
    }
    if (store.balance.kind !== 'live' || store.balance.loading || !store.balance.availableYocto || stakeable == null) {
      setError(store.balance.loading ? 'The available balance is still loading.' : 'Connect a wallet so the available balance can be checked.');
      return;
    }
    const requested = parseStakeAmount(amount);
    if (requested == null || requested > stakeable) {
      setError(`That leaves less than ${formatNear(FEE_RESERVE_YOCTO)} NEAR for the transaction fee. The most you can stake is ${formatNear(stakeable)} NEAR. Storage rent is already excluded.`);
      return;
    }
    setError('');
    setChecked(false);
    setResult(null);
    setStage(1);
  }

  async function approve() {
    if (sending || !checked || !validator || !store.accountId || !enabled) return;
    const requested = parseStakeAmount(amount);
    if (requested == null || stakeable == null || requested > stakeable) return;
    setSending(true);
    setError('');
    try {
      const previous = await readAccountStaked(store.network, validator.id, store.accountId);
      const outcome = await requestStakeSignature({
        network: store.network,
        signerId: store.accountId,
        poolId: validator.id,
        amountYocto: requested,
      });
      const confirmed = await confirmStake({
        network: store.network,
        hash: transactionHash(outcome),
        signerId: store.accountId,
        poolId: validator.id,
        amountYocto: requested,
        previousStakedYocto: previous,
      });
      if (!confirmed.ok) {
        setResult({ kind: confirmed.kind, hash: confirmed.hash, message: confirmed.message });
        setStage(3);
        return;
      }
      const when = new Date().toISOString();
      saveStakeActivity({
        hash: confirmed.hash,
        accountId: store.accountId,
        network: store.network,
        poolId: validator.id,
        amount,
        commission: validator.commission,
        when,
      });
      store.refreshHoldings();
      setResult({
        kind: 'success',
        hash: confirmed.hash,
        explorer: explorerTx(store.network, confirmed.hash),
        staked: formatNear(confirmed.stakedYocto),
      });
      setStage(3);
    } catch (caught) {
      const explained = explainStakeError(caught);
      setResult({ kind: explained.kind, hash: null, message: explained.message });
      setStage(3);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Easy Staking</h1>
          <p className="lede">Choose an amount and a validator. Your wallet approves a testnet stake. Mainnet staking and unstaking stay off.</p>
          <Capability
            ready={enabled ? 'Testnet staking asks your wallet to approve' : 'Review works on this network'}
            chain={enabled ? 'Success waits for a final NEAR transaction' : 'Mainnet staking is off'}
          />
        </div>
        <button type="button" className="btn btn-secondary" onClick={store.openGlossary}>
          Explain the words
        </button>
      </div>

      <div className="stat-grid stat-grid-2">
        <section className="card stat">
          <span>Available to stake</span>
          <strong>{stakeable == null ? nearLine(store.balance, 'available') : `${formatNear(stakeable)} NEAR`}</strong>
          <span className="hint">
            {store.balance.kind === 'sample'
              ? 'Sample balance. It cannot be staked.'
              : store.balance.kind === 'live'
                ? `${formatNear(FEE_RESERVE_YOCTO)} NEAR stays unstaked for the fee. Storage rent is already excluded.`
                : 'Unknown until a wallet is connected'}
          </span>
        </section>
        <section className="card stat">
          <span>Reward estimate</span>
          <strong>Unavailable</strong>
          <span className="hint">Commission is read from the pool. A reward rate is not estimated.</span>
        </section>
      </div>

      <div className="split">
        <section className="card flow-card">
          <Stepper steps={steps} current={stage} />
          {stage === 0 ? (
            <>
              <Field
                id="stake-amount"
                label="Stake amount (NEAR)"
                hint={
                  stakeable != null
                    ? `At most ${formatNear(stakeable)} NEAR. Reviewing does not stake it.`
                    : store.balance.kind === 'sample'
                      ? 'Checked against a connected wallet, not the sample balance.'
                      : 'Your available balance is unknown until a wallet is connected.'
                }
                error={error}
              >
                <input id="stake-amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} />
              </Field>
              <Field id="stake-validator" label="Validator">
                <select
                  id="stake-validator"
                  value={validatorId}
                  disabled={!pools.length}
                  onChange={(event) => setValidatorId(event.target.value)}
                >
                  {pools.length === 0 ? (
                    <option value="">{poolsLoading ? 'Reading validators…' : 'No validator available'}</option>
                  ) : (
                    pools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} · {item.commission}
                      </option>
                    ))
                  )}
                </select>
              </Field>
              {poolsError ? <p className="field-error" role="alert">{poolsError}</p> : null}
              <Button variant="primary" className="btn-block" onClick={review} disabled={poolsLoading || sending}>
                Review stake
              </Button>
            </>
          ) : null}
          {stage === 1 && validator ? (
            <>
              <TxTable
                rows={[
                  { label: 'Amount', value: `${amount} NEAR` },
                  { label: 'Validator', value: validator.label },
                  { label: 'Pool account', value: validator.id },
                  { label: 'Commission', value: `${validator.commission} (${validator.fraction}), read from the pool` },
                  { label: 'Pool stake', value: validator.poolStake },
                  { label: 'Network', value: store.network },
                  { label: 'Account', value: store.accountId ?? 'Not connected' },
                  { label: 'Kept for the fee', value: `${formatNear(FEE_RESERVE_YOCTO)} NEAR` },
                  { label: 'Storage', value: 'Left on the account. It is already excluded from the available balance.' },
                  { label: 'Attached gas', value: '300 TGas. Unused gas returns to the account.' },
                  { label: 'NEAR Easy fee', value: 'None' },
                  { label: 'Action', value: 'deposit_and_stake' },
                  { label: 'Status', value: 'Not submitted' },
                ]}
              />
              <div className="inline-actions">
                <Button onClick={() => setStage(0)}>Back</Button>
                <Button variant="primary" onClick={() => setStage(2)}>Continue</Button>
              </div>
            </>
          ) : null}
          {stage === 2 && validator ? (
            <>
              {enabled ? (
                <p>Your wallet will ask you to sign. This page cannot sign, and it does not ask for a seed phrase or a private key.</p>
              ) : (
                <p>This preview is complete. Mainnet staking is not enabled.</p>
              )}
              <label className="check">
                <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={!enabled || sending} />
                <span>I want to stake this NEAR. My wallet must approve it.</span>
              </label>
              {sending ? <p className="loading-line" role="status">Waiting for your wallet, then for NEAR to confirm the transaction…</p> : null}
              <div className="inline-actions">
                <Button onClick={() => setStage(1)} disabled={sending}>Back</Button>
                {enabled ? (
                  <Button variant="primary" disabled={!checked || sending} onClick={() => void approve()}>
                    Approve in wallet
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => void store.setNetwork('testnet')}>
                    Use testnet
                  </Button>
                )}
              </div>
            </>
          ) : null}
          {stage === 3 && result ? (
            <div id="stake-result">
              {result.kind === 'success' ? (
                <>
                  <h2>Stake confirmed</h2>
                  <p>
                    {amount} NEAR was delegated to {validator?.label ?? 'the pool'}. The pool now reports {result.staked} NEAR staked for this account.
                  </p>
                  <p className="mono">{result.hash}</p>
                  <a className="btn btn-secondary" href={result.explorer} target="_blank" rel="noreferrer">View on the explorer</a>
                </>
              ) : (
                <>
                  <h2>{result.kind === 'rejected' ? 'Stake declined' : result.kind === 'failed' ? 'Stake failed' : 'Stake not confirmed'}</h2>
                  <p>{result.message}</p>
                  {result.hash ? <p className="mono">{result.hash}</p> : null}
                </>
              )}
              <Button onClick={() => { setStage(0); setChecked(false); setResult(null); }}>Edit amount or validator</Button>
            </div>
          ) : null}
        </section>

        <aside className="stack">
          <section className="card">
            <h2>{validator ? validator.label : 'Validator'}</h2>
            {validator ? (
              <>
                <p>Commission {validator.commission} is read from this pool contract. Rewards are not guaranteed and are not estimated here.</p>
                <p className="mono">{validator.id}</p>
                <p className="hint">Pool stake {validator.poolStake}.</p>
                <a className="btn btn-secondary" href={explorerAccount(store.network, validator.id)} target="_blank" rel="noreferrer">
                  Pool on the explorer
                </a>
              </>
            ) : (
              <p>{poolsLoading ? 'Reading the current validator set and each pool commission.' : poolsError || 'Choose a pool from the list.'}</p>
            )}
            <a className="text-btn" href={store.network === 'testnet' ? 'https://testnet.nearblocks.io/validators' : 'https://nearblocks.io/validators'} target="_blank" rel="noreferrer">
              Full public validator list
            </a>
          </section>
          <section className="card" id="unstake">
            <h2>Unstaking and withdrawals</h2>
            <p className="safety">Unstaking is not instant. You cannot spend that NEAR until the wait finishes. This page cannot unstake or withdraw.</p>
            <Help title="How long the wait usually takes">
              <p>NEAR releases a stake after 4 epochs. An epoch is about 12 hours, so the wait is often about 2 days. It can be longer if epochs run long.</p>
              <p>Rewards stop on the amount you unstake. Withdrawing after the wait is a separate action.</p>
            </Help>
          </section>
        </aside>
      </div>

      <section className="card">
        <header className="card-head">
          <span>Existing staking positions</span>
          {store.balance.kind === 'sample' ? <Badge tone="demo">Sample</Badge> : null}
        </header>
        {store.balance.kind === 'live' ? (
          store.balance.loading && !store.balance.staked ? (
            <p>Reading staking positions…</p>
          ) : store.balance.pools.length ? (
            <div className="pool-list">
              {store.balance.pools.map((pool) => (
                <p key={pool.id}>
                  <span className="mono">{pool.id}</span>
                  Staked {pool.staked} NEAR. Pending unstake {pool.pending} NEAR.
                  {pool.withdrawable !== '0' && !pool.withdrawable.startsWith('<') ? ` Ready to withdraw ${pool.withdrawable} NEAR.` : ''}
                </p>
              ))}
            </div>
          ) : (
            <p>{store.balance.note || 'No staking position was returned for this account.'}</p>
          )
        ) : store.balance.kind === 'sample' ? (
          <TxTable
            rows={[
              { label: 'Validator', value: 'Figment' },
              { label: 'Staked', value: `${sampleWallet.staked} NEAR` },
              { label: 'Pending unstake', value: `${sampleWallet.pending} NEAR` },
              { label: 'Status', value: 'Example position. Not your stake.' },
            ]}
          />
        ) : (
          <p>No staking position is shown because no wallet is connected.</p>
        )}
        {store.balance.kind === 'live' && store.balance.note && store.balance.pools.length ? <p className="hint">{store.balance.note}</p> : null}
        <p className="hint">
          Leave liquid NEAR for fees. Tidepool test wNEAR cannot be staked as native NEAR. <Link to="/funding">Funding</Link> and staking stay separate.
        </p>
      </section>
    </div>
  );
}
