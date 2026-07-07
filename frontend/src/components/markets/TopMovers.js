import React, { useMemo } from 'react';
import { formatINR } from '../../constants';
import MiniChart from './MiniChart';

function MoverColumn({ title, stocks }) {
  return (
    <div className="markets-mover-column">
      <h4>{title}</h4>
      {stocks.length ? stocks.map((stock) => (
        <div className="markets-mover-row" key={`${title}-${stock.symbol}`}>
          <span><strong>{stock.symbol}</strong><small>{formatINR(stock.price)}</small></span>
          <MiniChart price={stock.price} changePercent={stock.changePercent} />
          <strong className={stock.changePercent >= 0 ? 'text-positive' : 'text-negative'}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</strong>
        </div>
      )) : <div className="empty-panel small">No stocks available.</div>}
    </div>
  );
}

function TopMovers({ stocks }) {
  const groups = useMemo(() => ({
    gainers: [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4),
    losers: [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4),
    active: [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 4),
    high52: [...stocks].sort((a, b) => (b.price / b.weekHigh52) - (a.price / a.weekHigh52)).slice(0, 4),
    low52: [...stocks].sort((a, b) => (a.price / a.weekLow52) - (b.price / b.weekLow52)).slice(0, 4)
  }), [stocks]);

  return (
    <section className="markets-movers-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Top movers</p>
          <h3>Opportunity board</h3>
        </div>
      </div>
      <div className="markets-movers-grid">
        <MoverColumn title="Top Gainers" stocks={groups.gainers} />
        <MoverColumn title="Top Losers" stocks={groups.losers} />
        <MoverColumn title="Most Active" stocks={groups.active} />
        <MoverColumn title="52 Week High" stocks={groups.high52} />
        <MoverColumn title="52 Week Low" stocks={groups.low52} />
      </div>
    </section>
  );
}

export default TopMovers;
