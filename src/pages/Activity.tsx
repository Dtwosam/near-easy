import { useState } from 'react';
import { statusExamples } from '../data';
import { readFundingActivity, verifiedTestnetFunding } from '../funding/plan';
import { explorerTx, readStakeActivity, verifiedTestnetStake } from '../near/stakePlan';
import { Badge, Capability, EmptyState, useTitle } from '../ui';

const filters = ['All', 'Verified', 'Failed', 'Pending'] as const;

export function ActivityPage() {
  useTitle('Activity');
  const [tab, setTab] = useState<'yours' | 'examples'>('yours');
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const savedStakes = readStakeActivity();
  const stakes = (savedStakes.some((item) => item.hash === verifiedTestnetStake.hash)
    ? savedStakes
    : [verifiedTestnetStake, ...savedStakes]
  ).slice().sort((a, b) => b.when.localeCompare(a.when));
  const savedFunding = readFundingActivity();
  const funding = (savedFunding.some((item) => item.depositAddress === verifiedTestnetFunding.depositAddress)
    ? savedFunding
    : [verifiedTestnetFunding, ...savedFunding]
  ).slice().sort((a, b) => b.when.localeCompare(a.when));
  const rows = statusExamples.filter((row) => {
    if (filter === 'All') return true;
    return row.status.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Activity</h1>
          <p className="lede">Confirmed stakes and Tidepool statuses appear here. Examples stay in a separate tab.</p>
          <Capability ready="Filters and example layouts work" chain={stakes.length || funding.length ? 'Saved network results are listed' : 'No confirmed transfer yet'} />
        </div>
      </div>

      <div className="pills" role="tablist" aria-label="Activity source">
        <button type="button" role="tab" aria-selected={tab === 'yours'} className={tab === 'yours' ? 'on' : ''} onClick={() => setTab('yours')}>
          Your activity
        </button>
        <button type="button" role="tab" aria-selected={tab === 'examples'} className={tab === 'examples' ? 'on' : ''} onClick={() => setTab('examples')}>
          Status examples
        </button>
      </div>

      {tab === 'yours' ? (
        stakes.length === 0 && funding.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No transactions yet"
            body="Confirmed stakes and Tidepool statuses show here. This list is empty."
          />
        ) : (
          <ul className="tx-list">
            {funding.map((item) => (
              <li key={item.depositAddress} className="card tx-item">
                <div className="tx-summary">
                  <div>
                    <strong>Funding</strong>
                    <span>{item.when}</span>
                  </div>
                  <div>
                    <span>{item.origin}</span>
                    <span>{item.destination}</span>
                  </div>
                  <Badge tone={item.status === 'SUCCESS' ? 'accent' : item.status === 'FAILED' ? 'danger' : 'warn'}>{item.label}</Badge>
                </div>
                <div className="tx-detail">
                  <p>Tidepool status {item.status}. Output {item.amountOut}. {item.destination}. {item.refundReason ? `Refund reason ${item.refundReason}.` : item.status === 'SUCCESS' ? 'Finished because Tidepool reported SUCCESS. The output is a testnet token, not native NEAR.' : 'A pending status is not success.'}</p>
                  {item.hashes.length ? item.hashes.map((hash) => (
                    <p key={`${hash.label}-${hash.hash}`}>
                      <span className="mono">{hash.hash}</span>
                      {hash.url ? <a href={hash.url} target="_blank" rel="noreferrer">View on the testnet explorer</a> : <span> Explorer link withheld.</span>}
                    </p>
                  )) : <p>No verified transaction hash was included.</p>}
                </div>
              </li>
            ))}
            {stakes.map((stake) => (
              <li key={stake.hash} className="card tx-item">
                <div className="tx-summary">
                  <div>
                    <strong>Stake</strong>
                    <span>{stake.when}</span>
                  </div>
                  <div>
                    <span>{stake.amount} NEAR</span>
                    <span>{stake.network}</span>
                  </div>
                  <Badge tone="accent">Confirmed</Badge>
                </div>
                <div className="tx-detail">
                  <p>Delegated from {stake.accountId} to {stake.poolId}. Pool commission {stake.commission}.</p>
                  <p className="mono">{stake.hash}</p>
                  <a href={explorerTx(stake.network, stake.hash)} target="_blank" rel="noreferrer">View on the explorer</a>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div className="pills" role="toolbar" aria-label="Example status">
            {filters.map((item) => (
              <button key={item} type="button" className={filter === item ? 'on' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState icon="search" title="No examples with this status" body="Choose another status. These rows are still only examples." />
          ) : (
            <ul className="tx-list">
              {rows.map((row) => {
                const open = openId === row.id;
                return (
                  <li key={row.id} className="card tx-item">
                    <div className="tx-summary">
                      <div>
                        <strong>{row.title}</strong>
                        <span>{row.when}</span>
                      </div>
                      <div>
                        <span>{row.amount}</span>
                        <span>{row.network}</span>
                      </div>
                      <Badge tone="demo">{row.status}</Badge>
                      <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : row.id)}>
                        {open ? 'Hide details' : 'Details'}
                      </button>
                    </div>
                    {open ? (
                      <div className="tx-detail">
                        <p>{row.note}</p>
                        <p>Explorer link: unavailable. This example has no transaction hash.</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
