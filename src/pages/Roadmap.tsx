import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { features, groups, statusLabel } from '../data';
import type { Feature, Status } from '../data';
import { Icon } from '../icons';
import { Badge, Capability, Modal, useTitle } from '../ui';

const filters: { id: 'all' | Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'building', label: 'In Development' },
  { id: 'soon', label: 'Coming Soon' },
];

function tone(status: Status): 'accent' | 'warn' | 'muted' {
  if (status === 'available') return 'accent';
  if (status === 'building') return 'warn';
  return 'muted';
}

export function RoadmapPage() {
  useTitle('Features and roadmap');
  const [params, setParams] = useSearchParams();
  const requested = params.get('status');
  const active: 'all' | Status = requested === 'available' || requested === 'building' || requested === 'soon' ? requested : 'all';
  const [soonFeature, setSoonFeature] = useState<Feature | null>(null);
  const priorities = features.filter((feature) => feature.priority && feature.status === 'building');

  function setFilter(id: 'all' | Status) {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('status');
    else next.set('status', id);
    setParams(next, { replace: true });
  }

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Features</h1>
          <p className="lede">Thirty parts of the product. Available means you can use it. Easy Staking and cross-chain funding are available on testnet. Mainnet staking and mainnet transfers stay off.</p>
          <Capability ready="Available items do not broadcast" chain="Mainnet transfers stay off" />
        </div>
        <Badge tone="accent">30 features</Badge>
      </div>

      {priorities.length ? (
        <section className="priority-band">
          <h2>In progress</h2>
          <div className="qa-grid">
            {priorities.map((feature) => (
              <Link key={feature.id} to={feature.href ?? '/roadmap'} className="qa">
                <Badge tone="warn">{feature.statusText ?? statusLabel[feature.status]}</Badge>
                <strong>{feature.name}</strong>
                <span className="qa-copy">{feature.summary}</span>
                <em className="qa-arrow" aria-hidden="true">
                  <Icon name="arrow" size={16} />
                </em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pills" role="tablist" aria-label="Feature status">
        {filters.map((filter) => {
          const count = filter.id === 'all' ? features.length : features.filter((feature) => feature.status === filter.id).length;
          return (
            <button key={filter.id} type="button" role="tab" aria-selected={active === filter.id} className={active === filter.id ? 'on' : ''} onClick={() => setFilter(filter.id)}>
              {filter.label} {count}
            </button>
          );
        })}
      </div>

      {groups.map((group) => {
        const items = features.filter((feature) => feature.group === group && (active === 'all' || feature.status === active));
        if (items.length === 0) return null;
        return (
          <section key={group} className="feature-group">
            <h2>{group}</h2>
            <div className="feature-grid">
              {items.map((feature) => {
                const body = (
                  <>
                    <Badge tone={tone(feature.status)}>{feature.statusText ?? statusLabel[feature.status]}</Badge>
                    <strong>{feature.name}</strong>
                    <span className="qa-copy">{feature.summary}</span>
                    <span className="card-action">{feature.status === 'soon' || !feature.href ? 'Details' : 'Open'}</span>
                  </>
                );
                if (feature.status === 'soon' || !feature.href) {
                  return (
                    <button key={feature.id} type="button" className="feature-card" onClick={() => setSoonFeature(feature)}>
                      {body}
                    </button>
                  );
                }
                if (feature.href.startsWith('http')) {
                  return (
                    <a key={feature.id} className="feature-card" href={feature.href} target="_blank" rel="noreferrer">
                      {body}
                    </a>
                  );
                }
                return (
                  <Link key={feature.id} className="feature-card" to={feature.href}>
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <Modal open={Boolean(soonFeature)} title={soonFeature?.name ?? 'Coming soon'} onClose={() => setSoonFeature(null)}>
        <p>{soonFeature?.summary}</p>
        <p>This item is on the roadmap so you can see the plan. It does not run.</p>
      </Modal>
    </div>
  );
}
