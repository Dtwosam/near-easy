import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apps, categories } from '../data';
import type { AppCategory } from '../data';
import { Icon } from '../icons';
import { Capability, EmptyState, useTitle } from '../ui';

function isCategory(value: string | null): value is AppCategory {
  return categories.includes(value as AppCategory);
}

export function ExplorePage() {
  useTitle('Explore NEAR');
  const [params, setParams] = useSearchParams();
  const initial = isCategory(params.get('category')) ? (params.get('category') as AppCategory) : 'All';
  const [category, setCategory] = useState<AppCategory | 'All'>(initial);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setCategory(isCategory(params.get('category')) ? (params.get('category') as AppCategory) : 'All');
  }, [params]);

  function selectCategory(next: AppCategory | 'All') {
    setCategory(next);
    const updated = new URLSearchParams(params);
    if (next === 'All') updated.delete('category');
    else updated.set('category', next);
    setParams(updated, { replace: true });
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apps.filter((app) => {
      const categoryOk = category === 'All' || app.category === category;
      const text = `${app.name} ${app.description} ${app.category}`.toLowerCase();
      return categoryOk && (!needle || text.includes(needle));
    });
  }, [category, query]);

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1 className="page-title">Explore Apps</h1>
          <p className="lede">Public project sites. NEAR Easy does not run these apps or move funds inside them.</p>
          <Capability ready="Search and official links work" chain="These are not in-app integrations" />
        </div>
      </div>

      <div className="command search-command">
        <Icon name="search" />
        <label className="sr-only" htmlFor="explore-search">
          Search apps
        </label>
        <input
          id="explore-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or description"
        />
      </div>

      <div className="pills" role="toolbar" aria-label="Categories">
        <button type="button" className={category === 'All' ? 'on' : ''} aria-pressed={category === 'All'} onClick={() => selectCategory('All')}>
          All
        </button>
        {categories.map((item) => (
          <button key={item} type="button" className={category === item ? 'on' : ''} aria-pressed={category === item} onClick={() => selectCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      <p className="hint" aria-live="polite">
        {results.length} {results.length === 1 ? 'app' : 'apps'}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title={category === 'Gaming' || category === 'NFTs' ? `No ${category === 'Gaming' ? 'gaming' : 'NFT'} apps are listed yet` : 'No apps match'}
          body="The directory only lists projects with a confirmed public site. An empty category is not a broken filter."
        />
      ) : (
        <div className="app-grid">
          {results.map((app) => (
            <a key={app.name} className="app-card" href={app.url} target="_blank" rel="noreferrer">
              <span className="token-badge near">{app.name.slice(0, 1)}</span>
              <span className="app-copy">
                <strong>{app.name}</strong>
                <em>{app.category}</em>
                <span>{app.description}</span>
              </span>
              <span className="app-link">
                Visit App <Icon name="external" size={16} />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
