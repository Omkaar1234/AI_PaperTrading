import React from 'react';
import { formatINR } from '../../constants';
import { buildSparkline } from './dashboardUtils';
import Sparkline from './Sparkline';

const MARKET_ITEMS = [
  { symbol: 'NIFTY 50', value: 24892.35, change: 118.4, percent: 0.48 },
  { symbol: 'BANK NIFTY', value: 52610.8, change: -84.15, percent: -0.16 },
  { symbol: 'SENSEX', value: 81244.7, change: 292.9, percent: 0.36 },
  { symbol: 'INDIA VIX', value: 13.82, change: -0.42, percent: -2.95 },
  { symbol: 'USDINR', value: 83.48, change: 0.08, percent: 0.1 },
  { symbol: 'Gold', value: 72180, change: 356, percent: 0.5 },
  { symbol: 'Silver', value: 90240, change: -420, percent: -0.46 }
];

function MarketOverview() {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Market overview</p>
          <h3>India session pulse</h3>
        </div>
      </div>

      <div className="market-overview-grid">
        {MARKET_ITEMS.map((item, index) => {
          const positive = item.change >= 0;
          return (
            <article className="market-overview-card" key={item.symbol}>
              <div>
                <span>{item.symbol}</span>
                <strong>{item.symbol === 'USDINR' || item.symbol === 'INDIA VIX' ? item.value.toFixed(2) : formatINR(item.value)}</strong>
              </div>
              <Sparkline values={buildSparkline(index + 1)} tone={positive ? 'positive' : 'negative'} />
              <div className="market-overview-meta">
                <small className={positive ? 'text-positive' : 'text-negative'}>
                  {positive ? '+' : ''}{item.change.toFixed(2)} ({positive ? '+' : ''}{item.percent.toFixed(2)}%)
                </small>
                <small>Live</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default MarketOverview;
