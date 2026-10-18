import React from 'react';
import { formatINR } from '../constants';
function OverviewCards({ orders = [], positions = [], totalPortfolioValue = 0, user }) {
  const invested = (positions || []).reduce((sum, position) => sum + (Number(position.invested) || 0), 0);

  const cards = [
    { label: 'Portfolio Value', value: formatINR(totalPortfolioValue) },
    { label: 'Cash Balance', value: formatINR(user?.balance || 0) },
    { label: 'Open Orders', value: orders.filter((order) => ['OPEN', 'PARTIALLY_FILLED'].includes(order.status)).length },
    { label: 'Invested Capital', value: formatINR(invested) }
  ];

  return (
    <section className="overview-cards">
      {cards.map((card) => (
        <div className="metric-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </section>
  );
}

export default OverviewCards;
