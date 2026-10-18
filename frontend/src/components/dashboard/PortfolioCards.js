import React from 'react';
import { formatINR } from '../../constants';

function CardIcon({ type }) {
  switch (type) {
    case 'portfolio':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
        </svg>
      );
    case 'cash':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
        </svg>
      );
    case 'invested':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
      );
    case 'today':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/>
        </svg>
      );
    case 'pnl':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      );
    case 'holdings':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      );
    case 'orders':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      );
    case 'trades':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
        </svg>
      );
    default:
      return null;
  }
}

function PortfolioCards({ user, positions, portfolioValue, investedAmount, todayPnl, totalPnl }) {
  const isTotalPositive = totalPnl >= 0;
  const totalPnlPercent = investedAmount > 0 ? ((totalPnl / investedAmount) * 100).toFixed(2) : '0.00';
  const isTodayPositive = todayPnl !== null && todayPnl >= 0;

  const cards = [
    {
      label: 'Portfolio Value',
      iconType: 'portfolio',
      value: formatINR(portfolioValue),
      badgeText: `${isTotalPositive ? '+' : ''}${formatINR(totalPnl)} (${isTotalPositive ? '+' : ''}${totalPnlPercent}%)`,
      badgeTone: isTotalPositive ? 'positive' : 'negative',
      subtext: 'overall unrealized'
    },
    {
      label: 'Available Cash',
      iconType: 'cash',
      value: formatINR(user?.balance || 0),
      badgeText: 'Liquid',
      badgeTone: 'neutral',
      subtext: 'unallocated cash reserve'
    },
    {
      label: 'Invested Capital',
      iconType: 'invested',
      value: formatINR(investedAmount),
      badgeText: `${positions.length} ${positions.length === 1 ? 'Holding' : 'Holdings'}`,
      badgeTone: 'neutral',
      subtext: 'cost basis at acquisition'
    },
    {
      label: "Today's P&L",
      iconType: 'today',
      value: todayPnl === null ? '--' : `${isTodayPositive ? '+' : ''}${formatINR(todayPnl)}`,
      badgeText: todayPnl === null ? 'Pending' : (isTodayPositive ? 'Day Gain' : 'Day Loss'),
      badgeTone: todayPnl === null ? 'neutral' : (isTodayPositive ? 'positive' : 'negative'),
      subtext: todayPnl === null ? 'awaiting quote refresh' : 'intraday net movement'
    }
  ];

  return (
    <section className="dashboard-metric-grid" aria-label="Portfolio summary">
      {cards.map((card) => (
        <article className="metric-card" key={card.label}>
          <div className="metric-card-header">
            <span className="metric-card-label">{card.label}</span>
            <span className="metric-card-icon" aria-hidden="true">
              <CardIcon type={card.iconType} />
            </span>
          </div>
          <div className="metric-card-body">
            <strong className="metric-card-value">{card.value}</strong>
          </div>
          <div className="metric-card-footer">
            <span className={`metric-badge metric-badge-${card.badgeTone}`}>
              {card.badgeText}
            </span>
            <span className="metric-subtext">{card.subtext}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

export default PortfolioCards;
