import React from 'react';
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
  const greeting = getGreeting(new Date());
  const marketSession = getMarketSession(new Date());
  const isPositive = totalPnl >= 0;

  return (
    <section className="dashboard-brief">
      <div className="dashboard-brief-copy">
        <p className="eyebrow">Session brief</p>
        <h2>{greeting}, {user?.name || 'Trader'}</h2>
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
          <strong className={todayPnl === null ? 'text-muted' : todayPnl >= 0 ? 'text-positive' : 'text-negative'}>
            {todayPnl === null ? '--' : `${todayPnl >= 0 ? '+' : ''}${formatINR(todayPnl)}`}
          </strong>
        </div>
        <div>
          <span>Market Status</span>
          <strong>{marketSession}</strong>
        </div>
      </div>
    </section>
  );
}

export default DashboardHeader;
