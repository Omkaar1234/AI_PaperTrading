import React from 'react';
import { formatAssetPrice, getAssetIcon } from '../constants';

function WatchlistCard({ selectedAsset, selectAsset, watchlistDetails = [] }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h3>Tracked Symbols</h3>
        </div>
      </div>

      <div className="watchlist compact-watchlist">
        {watchlistDetails.length ? (
          watchlistDetails.slice(0, 6).map((asset) => (
            <button
              key={asset.symbol}
              className={`watchlist-quote ${selectedAsset?.symbol === asset.symbol ? 'active' : ''}`}
              onClick={() => selectAsset(asset)}
            >
              <div className="watchlist-quote-main">
                <span className="asset-badge">{getAssetIcon(asset.assetType)}</span>
                <div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </div>
              </div>
              <div className="watchlist-quote-side">
                <strong>{formatAssetPrice(asset.livePrice || 0, asset.assetType)}</strong>
                <span className={asset.change >= 0 ? 'text-positive' : 'text-negative'}>
                  {asset.change >= 0 ? '+' : ''}
                  {Number(asset.changePercent || 0).toFixed(2)}%
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-panel small">No watchlist assets available.</div>
        )}
      </div>
    </section>
  );
}

export default WatchlistCard;
