import React, { useMemo } from 'react';
import { SECTORS } from './marketUtils';

function MarketHeatmap({ stocks }) {
  const sectors = useMemo(() => SECTORS.map((sector) => {
    const items = stocks.filter((stock) => stock.sector === sector);
    const performance = items.length
      ? items.reduce((sum, stock) => sum + stock.changePercent, 0) / items.length
      : 0;
    const sorted = [...items].sort((a, b) => b.changePercent - a.changePercent);
    return {
      sector,
      count: items.length,
      performance,
      best: sorted[0],
      worst: sorted.at(-1)
    };
  }).filter((sector) => sector.count > 0), [stocks]);

  return (
    <section className="markets-side-card market-heatmap">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sector heatmap</p>
          <h3>Market breadth</h3>
        </div>
      </div>
      <div className="heatmap-grid">
        {sectors.length ? sectors.map((item) => (
          <article className={item.performance >= 0 ? 'positive' : 'negative'} key={item.sector}>
            <strong>{item.sector}</strong>
            <span>{item.performance >= 0 ? '+' : ''}{item.performance.toFixed(2)}%</span>
            <small>{item.count} stocks</small>
            <small>Best: {item.best?.symbol || '--'}</small>
            <small>Worst: {item.worst?.symbol || '--'}</small>
          </article>
        )) : <div className="empty-panel small">Load stocks to generate sector heatmap.</div>}
      </div>
    </section>
  );
}

export default MarketHeatmap;
