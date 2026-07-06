import React from 'react';
import OverviewCards from '../components/OverviewCards';
import TradesCard from '../components/TradesCard';

function DashboardPage({ trading }) {
  return (
    <div className="page">
      <OverviewCards
        orders={trading.orders}
        positions={trading.positions}
        totalPortfolioValue={trading.getTotalPortfolioValue()}
        user={trading.user}
      />

      <TradesCard recentTrades={trading.recentTrades.slice(0, 8)} />
    </div>
  );
}

export default DashboardPage;
