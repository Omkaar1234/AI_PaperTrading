import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui';
import { getMarketSession } from '../dashboard/dashboardUtils';

function MarketHeader({ totalStocks, lastUpdated }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = getMarketSession(now);
  const isOpen = status === 'Market Open';
  const time = useMemo(() => new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short'
  }).format(lastUpdated || now), [lastUpdated, now]);

  return (
    <section className="markets-header">
      <div>
        <p className="eyebrow">Indian equities</p>
        <h2>Markets</h2>
        <p>NSE/BSE stock discovery, watchlist control, and one-click trade entry.</p>
      </div>
      <div className="markets-header-stats">
        <Badge tone={isOpen ? 'positive' : 'negative'} className="market-status"><span aria-hidden="true" />{status}</Badge>
        <div><span>Last updated</span><strong>{time}</strong></div>
        <div><span>Stocks loaded</span><strong>{Number(totalStocks || 0).toLocaleString('en-IN')}</strong></div>
      </div>
    </section>
  );
}

export default MarketHeader;
