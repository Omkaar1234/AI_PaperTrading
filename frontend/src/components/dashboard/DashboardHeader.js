import React, { useEffect, useMemo, useState } from 'react';
import { formatINR } from '../../constants';
import { getMarketSession } from './dashboardUtils';

function getGreeting(date) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function DashboardHeader({ user, portfolioValue, todayPnl, totalPnl }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(now),
    [now]
  );

  const marketSession = getMarketSession(now);
  const isPositive = totalPnl >= 0;

  return (
    <section className="dashboard-brief">
      <div className="dashboard-brief-copy">
        <p className="eyebrow">Session brief</p>
        <h2>{getGreeting(now)}, {user?.name || 'Trader'}</h2>
        <p>Review risk, market movement, AI signals, and execution activity before placing the next simulated order.</p>
      </div>

      <div className="dashboard-brief-value">
        <span>Portfolio value</span>
        <strong>{formatINR(portfolioValue)}</strong>
        <small className={isPositive ? 'text-positive' : 'text-negative'}>
          {isPositive ? '+' : ''}{formatINR(totalPnl)} overall P&L
        </small>
      </div>

      <div className="dashboard-brief-grid">
        <div>
          <span>Today P&L</span>
          <strong className={todayPnl >= 0 ? 'text-positive' : 'text-negative'}>
            {todayPnl >= 0 ? '+' : ''}{formatINR(todayPnl)}
          </strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{marketSession}</strong>
        </div>
        <div>
          <span>IST clock</span>
          <strong>{formattedDate}</strong>
        </div>
      </div>
    </section>
  );
}

export default DashboardHeader;
