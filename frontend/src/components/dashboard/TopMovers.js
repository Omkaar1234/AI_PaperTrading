import React, { useMemo } from 'react';
import { formatAssetPrice } from '../../constants';
import { buildSparkline, getQuoteChangePercent } from './dashboardUtils';
import Sparkline from './Sparkline';

function MoverList({ title, assets, tone }) {
  return (
    <section className="dashboard-section mover-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">{tone === 'positive' ? 'Strength' : 'Weakness'}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="mover-list">
        {assets.length ? (
          assets.map((asset, index) => (
            <div className="mover-row" key={asset.symbol}>
              <span>
                <strong>{asset.symbol}</strong>
                <small>{formatAssetPrice(asset.livePrice || asset.price || 0, asset.assetType)}</small>
              </span>
              <Sparkline values={buildSparkline(index + (tone === 'positive' ? 3 : 9))} tone={tone} />
              <strong className={tone === 'positive' ? 'text-positive' : 'text-negative'}>
                {tone === 'positive' ? '+' : ''}{asset.changePercent.toFixed(2)}%
              </strong>
            </div>
          ))
        ) : (
          <div className="empty-panel small">Add symbols to your watchlist to see movers.</div>
        )}
      </div>
    </section>
  );
}

function TopMovers({ watchlistDetails }) {
  const movers = useMemo(
    () =>
      watchlistDetails
        .map((asset) => ({ ...asset, changePercent: getQuoteChangePercent(asset) }))
        .filter((asset) => Number.isFinite(asset.changePercent)),
    [watchlistDetails]
  );

  const gainers = [...movers].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...movers].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  return (
    <div className="top-movers-grid">
      <MoverList title="Top Gainers" assets={gainers} tone="positive" />
      <MoverList title="Top Losers" assets={losers} tone="negative" />
    </div>
  );
}

export default TopMovers;
