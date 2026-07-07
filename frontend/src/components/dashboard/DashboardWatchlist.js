import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatAssetPrice } from '../../constants';
import { getQuoteChangePercent } from './dashboardUtils';

function DashboardWatchlist({ trading }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return trading.watchlistDetails.filter((asset) => {
      if (!needle) {
        return true;
      }
      return asset.symbol.includes(needle) || String(asset.name || '').toUpperCase().includes(needle);
    });
  }, [query, trading.watchlistDetails]);

  const handleTrade = async (asset) => {
    await trading.selectAsset(asset);
    navigate('/trade');
  };

  return (
    <section className="dashboard-section dashboard-watchlist-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h3>Tracked symbols</h3>
        </div>
        <input
          className="dashboard-inline-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search watchlist"
          aria-label="Search watchlist"
        />
      </div>

      <div className="dashboard-watchlist-table">
        <div className="dashboard-watchlist-head">
          <span>Symbol</span>
          <span>Price</span>
          <span>Change %</span>
          <span>Volume</span>
          <span>High</span>
          <span>Low</span>
          <span>Trade</span>
          <span>Remove</span>
        </div>

        {filteredAssets.length ? (
          filteredAssets.map((asset) => {
            const quote = trading.marketQuotes[asset.symbol] || {};
            const changePercent = getQuoteChangePercent({ ...quote, changePercent: asset.changePercent });
            const positive = changePercent >= 0;
            const price = asset.livePrice || asset.price || quote.price || 0;
            const high = quote.dayHigh || quote.high || price * 1.012;
            const low = quote.dayLow || quote.low || price * 0.988;

            return (
              <div className="dashboard-watchlist-row" key={asset.symbol}>
                <span>
                  <strong>{asset.symbol}</strong>
                  <small>{asset.name}</small>
                </span>
                <span>{formatAssetPrice(price, asset.assetType)}</span>
                <span className={positive ? 'text-positive' : 'text-negative'}>
                  {positive ? '+' : ''}{changePercent.toFixed(2)}%
                </span>
                <span>{Number(asset.volume || quote.volume || 0).toLocaleString('en-IN')}</span>
                <span>{formatAssetPrice(high, asset.assetType)}</span>
                <span>{formatAssetPrice(low, asset.assetType)}</span>
                <button type="button" className="table-action" onClick={() => handleTrade(asset)}>Trade</button>
                <button type="button" className="secondary-button" onClick={() => trading.removeWatchlistSymbol(asset.symbol)}>Remove</button>
              </div>
            );
          })
        ) : (
          <div className="empty-panel">No watchlist symbols match your search.</div>
        )}
      </div>
    </section>
  );
}

export default DashboardWatchlist;
