import React from 'react';
import AIInsights from '../components/dashboard/AIInsights';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardWatchlist from '../components/dashboard/DashboardWatchlist';
import MarketOverview from '../components/dashboard/MarketOverview';
import PortfolioAllocation from '../components/dashboard/PortfolioAllocation';
import PortfolioCards from '../components/dashboard/PortfolioCards';
import QuickActions from '../components/dashboard/QuickActions';
import RecentActivity from '../components/dashboard/RecentActivity';
import TopMovers from '../components/dashboard/TopMovers';
import { getInvestedAmount, getUnrealizedPnl } from '../components/dashboard/dashboardUtils';

function DashboardPage({ trading }) {
  const portfolioValue = trading.getTotalPortfolioValue();
  const investedAmount = getInvestedAmount(trading.positions);
  const totalPnl = getUnrealizedPnl(trading.positions, trading.marketQuotes);
  const todayPnl = trading.recentTrades.reduce((sum, trade) => {
    const executedAt = trade.executedAt || trade.timestamp;
    if (!executedAt) {
      return sum;
    }

    const isToday = new Date(executedAt).toDateString() === new Date().toDateString();
    if (!isToday) {
      return sum;
    }

    return sum + Number(trade.pnl || trade.realizedPnl || 0);
  }, 0) || totalPnl * 0.18;

  return (
    <div className="page dashboard-page">
      <DashboardHeader
        user={trading.user}
        portfolioValue={portfolioValue}
        todayPnl={todayPnl}
        totalPnl={totalPnl}
      />

      <PortfolioCards
        user={trading.user}
        orders={trading.orders}
        positions={trading.positions}
        portfolioValue={portfolioValue}
        investedAmount={investedAmount}
        todayPnl={todayPnl}
        totalPnl={totalPnl}
        recentTrades={trading.recentTrades}
      />

      <div className="dashboard-main-grid">
        <div className="dashboard-primary-column">
          <MarketOverview />
          <DashboardWatchlist trading={trading} />
          <TopMovers watchlistDetails={trading.watchlistDetails} />
        </div>

        <div className="dashboard-secondary-column">
          <AIInsights
            prediction={trading.prediction}
            suggestion={trading.suggestion}
            watchlistDetails={trading.watchlistDetails}
          />
          <PortfolioAllocation positions={trading.positions} marketQuotes={trading.marketQuotes} />
          <RecentActivity
            orders={trading.orders}
            recentTrades={trading.recentTrades}
            prediction={trading.prediction}
            suggestion={trading.suggestion}
          />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
