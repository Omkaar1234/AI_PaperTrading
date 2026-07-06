import React from 'react';
import { ASSET_TYPES, formatAssetPrice, getAssetIcon } from '../constants';

function AssetPanel({
  addToWatchlist,
  assetType,
  selectedAsset,
  selectAsset,
  setAssetType,
  watchlistDetails = [],
  watchlistInput,
  setWatchlistInput,
  removeWatchlistSymbol
}) {
  return (
    <section className="card asset-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Market selection</p>
          <h3>Watchlist & Universe</h3>
        </div>
      </div>

      <div className="segment-control">
        <button className={assetType === ASSET_TYPES.STOCKS ? 'active' : ''} onClick={() => setAssetType(ASSET_TYPES.STOCKS)}>
          Stocks
        </button>
        <button className={assetType === ASSET_TYPES.CRYPTO ? 'active' : ''} onClick={() => setAssetType(ASSET_TYPES.CRYPTO)}>
          Crypto
        </button>
        <button className={assetType === ASSET_TYPES.FOREX ? 'active' : ''} onClick={() => setAssetType(ASSET_TYPES.FOREX)}>
          Forex
        </button>
      </div>

      <div className="watchlist-composer">
        <input
          type="text"
          placeholder="Add symbol e.g. RELIANCE.NS or BTCUSDT"
          value={watchlistInput}
          onChange={(event) => setWatchlistInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              addToWatchlist();
            }
          }}
        />
        <button className="secondary-button" onClick={addToWatchlist}>
          Add
        </button>
      </div>

      <div className="watchlist terminal-watchlist">
        <div className="section-heading compact">
          <h4>Live Watchlist</h4>
        </div>
        {watchlistDetails.map((asset) => (
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
            <span
              className="watchlist-remove"
              onClick={(event) => {
                event.stopPropagation();
                removeWatchlistSymbol(asset.symbol);
              }}
              role="button"
              tabIndex={0}
            >
              Remove
            </span>
          </button>
        ))}
      </div>

      <div className="asset-list">
        {watchlistDetails.length ? (
          watchlistDetails
            .filter((asset) => asset.assetType === assetType)
            .map((asset) => (
              <button
                key={asset.symbol}
                className={`asset-row ${selectedAsset?.symbol === asset.symbol ? 'active' : ''}`}
                onClick={() => selectAsset(asset)}
              >
                <div className="asset-row-meta">
                  <span className="asset-badge">{getAssetIcon(assetType)}</span>
                  <div>
                    <strong>{asset.symbol}</strong>
                    <span>{asset.name}</span>
                  </div>
                </div>
                <strong>{formatAssetPrice(asset.livePrice || asset.price || 0, asset.assetType)}</strong>
              </button>
            ))
        ) : (
          <div className="empty-panel small">Use symbol search to populate this list.</div>
        )}
      </div>
    </section>
  );
}

export default AssetPanel;
