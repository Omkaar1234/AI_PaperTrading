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

      <div className="table-responsive-container">
        {filteredAssets.length ? (
          <table className="financial-table dashboard-watchlist-table" aria-label="Watchlist instruments">
            <thead>
              <tr>
                <th className="text-left">Symbol</th>
                <th className="text-right">Price</th>
                <th className="text-right">Change</th>
                <th className="text-right">Volume</th>
                <th className="text-right">Day Range</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const quote = trading.marketQuotes[asset.symbol] || {};
                const changePercent = getQuoteChangePercent({ ...quote, changePercent: asset.changePercent });
                const positive = changePercent >= 0;
                const price = asset.livePrice || asset.price || quote.price || 0;
                const high = quote.dayHigh || quote.high || price * 1.012;
                const low = quote.dayLow || quote.low || price * 0.988;

                return (
                  <tr key={asset.symbol}>
                    <td className="text-left">
                      <div className="symbol-cell">
                        <strong>{asset.symbol}</strong>
                        <small className="text-muted">{asset.name || asset.symbol}</small>
                      </div>
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatAssetPrice(price, asset.assetType)}
                    </td>
                    <td className="text-right tabular-nums">
                      <span className={`metric-pill ${positive ? 'pill-positive' : 'pill-negative'}`}>
                        {positive ? '+' : ''}{changePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-muted text-sm">
                      {Number(asset.volume || quote.volume || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right tabular-nums text-sm">
                      <span>{formatAssetPrice(low, asset.assetType)}</span>
                      <span className="text-muted"> – </span>
                      <span>{formatAssetPrice(high, asset.assetType)}</span>
                    </td>
                    <td className="text-center">
                      <div className="action-button-group">
                        <button type="button" className="trade-cta-btn" onClick={() => handleTrade(asset)}>
                          Trade
                        </button>
                        <button
                          type="button"
                          className="remove-icon-btn"
                          title="Remove from watchlist"
                          aria-label={`Remove ${asset.symbol}`}
                          onClick={() => trading.removeWatchlistSymbol(asset.symbol)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-panel">No watchlist symbols match your search.</div>
        )}
      </div>
    </section>
  );
}

export default DashboardWatchlist;
