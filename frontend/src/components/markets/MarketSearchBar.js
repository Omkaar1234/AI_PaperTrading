import React from 'react';

function MarketSearchBar({ query, onQueryChange, suggestions, onSelectSuggestion }) {
  return (
    <section className="markets-search-panel">
      <div className="markets-search-input">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search company name, NSE symbol, or sector"
          aria-label="Search Indian stocks"
        />
      </div>
      {query.trim() && suggestions.length ? (
        <div className="markets-suggestions">
          {suggestions.slice(0, 7).map((asset) => (
            <button type="button" key={asset.symbol} onClick={() => onSelectSuggestion(asset)}>
              <span className="stock-logo">{asset.logoText}</span>
              <span><strong>{asset.name}</strong><small>{asset.symbol} · {asset.sector}</small></span>
              <em>{asset.exchange || 'NSE'}</em>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default MarketSearchBar;
