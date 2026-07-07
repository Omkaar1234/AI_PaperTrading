import React from 'react';
import { formatINR } from '../../constants';
import { getExecutedOrders, getOpenOrders } from './dashboardUtils';

function PortfolioCards({ user, orders, positions, portfolioValue, investedAmount, todayPnl, totalPnl, recentTrades }) {
  const cards = [
    { label: 'Portfolio Value', icon: 'PV', value: formatINR(portfolioValue), change: totalPnl, suffix: 'overall' },
    { label: 'Available Balance', icon: '₹', value: formatINR(user?.balance || 0), change: user?.balance || 0, suffix: 'cash' },
    { label: 'Invested Amount', icon: 'IN', value: formatINR(investedAmount), change: investedAmount ? (totalPnl / investedAmount) * 100 : 0, suffix: '%' },
    { label: "Today's P&L", icon: 'TD', value: `${todayPnl >= 0 ? '+' : ''}${formatINR(todayPnl)}`, change: todayPnl, suffix: 'day' },
    { label: 'Total P&L', icon: 'PL', value: `${totalPnl >= 0 ? '+' : ''}${formatINR(totalPnl)}`, change: totalPnl, suffix: 'net' },
    { label: 'Holdings', icon: 'HD', value: positions.length, change: positions.length, suffix: 'active' },
    { label: 'Open Orders', icon: 'OO', value: getOpenOrders(orders), change: getOpenOrders(orders), suffix: 'pending' },
    { label: 'Executed Trades', icon: 'EX', value: recentTrades.length || getExecutedOrders(orders), change: recentTrades.length || getExecutedOrders(orders), suffix: 'filled' }
  ];

  return (
    <section className="dashboard-card-grid" aria-label="Portfolio overview">
      {cards.map((card) => {
        const positive = Number(card.change || 0) >= 0;
        return (
          <article className="dashboard-metric-card" key={card.label}>
            <div className="dashboard-metric-top">
              <span className="dashboard-metric-icon">{card.icon}</span>
              <span className={positive ? 'trend-up' : 'trend-down'}>{positive ? '▲' : '▼'}</span>
            </div>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small className={positive ? 'text-positive' : 'text-negative'}>
              {typeof card.change === 'number' && card.suffix === '%' ? `${positive ? '+' : ''}${card.change.toFixed(2)}%` : card.suffix}
            </small>
          </article>
        );
      })}
    </section>
  );
}

export default PortfolioCards;
