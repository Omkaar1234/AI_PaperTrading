import React from 'react';
import AIInsights from '../components/dashboard/AIInsights';
import DashboardWatchlist from '../components/dashboard/DashboardWatchlist';
import MarketOverview from '../components/dashboard/MarketOverview';
import PortfolioAllocation from '../components/dashboard/PortfolioAllocation';
import PortfolioCards from '../components/dashboard/PortfolioCards';
import RecentActivity from '../components/dashboard/RecentActivity';
import TopMovers from '../components/dashboard/TopMovers';
import DisciplineWidget from '../components/dashboard/DisciplineWidget';
import { getInvestedAmount, getUnrealizedPnl } from '../components/dashboard/dashboardUtils';

function DashboardPage({ trading }) {
  const portfolioValue = trading.getTotalPortfolioValue();
  const investedAmount = getInvestedAmount(trading.positions);
  const totalPnl = getUnrealizedPnl(trading.positions, trading.marketQuotes);
  const todayPnl = React.useMemo(() => {
    // 1. Realized P&L from trades executed today
    const realizedToday = (trading.recentTrades || []).reduce((sum, trade) => {
      const executedAt = trade.executedAt || trade.timestamp;
      if (!executedAt) {
        return sum;
      }
      const isToday = new Date(executedAt).toDateString() === new Date().toDateString();
      if (!isToday) {
        return sum;
      }
      return sum + Number(trade.pnl || trade.realizedPnl || 0);
    }, 0);

    // 2. Day's unrealized P&L from active positions with live quote changes
    let unrealizedToday = 0;
    let hasValidQuoteChange = false;

    if (trading.positions && trading.positions.length > 0) {
      for (const pos of trading.positions) {
        const quote = trading.marketQuotes?.[pos.symbol];
        if (quote && typeof quote.change === 'number') {
          hasValidQuoteChange = true;
          unrealizedToday += Number(pos.quantity || 0) * quote.change;
        }
      }
    }

    // If user has no holdings and no trades today, today's P&L is genuinely 0
    if ((!trading.positions || trading.positions.length === 0) && (!trading.recentTrades || trading.recentTrades.length === 0)) {
      return 0;
    }

    if (realizedToday !== 0 || hasValidQuoteChange) {
      return realizedToday + unrealizedToday;
    }

    // If positions exist but live quote change is unavailable yet, return null (render '--')
    return null;
  }, [trading.positions, trading.marketQuotes, trading.recentTrades]);

  return (
    <div className="page dashboard-page">
      {/* ROW 1: Page Title + Description */}
      <div className="page-header dashboard-page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="page-subtext">Portfolio performance, active market exposure, and simulated trade execution.</p>
        </div>
      </div>

      {/* ROW 2: Core Financial Metrics */}
      <PortfolioCards
        user={trading.user}
        positions={trading.positions}
        portfolioValue={portfolioValue}
        investedAmount={investedAmount}
        todayPnl={todayPnl}
        totalPnl={totalPnl}
      />

      {/* ROW 3: Market Overview + Portfolio Mix */}
      <div className="dashboard-grid-row two-col-balanced">
        <MarketOverview />
        <PortfolioAllocation positions={trading.positions} marketQuotes={trading.marketQuotes} />
      </div>

      {/* ROW 4: Watchlist + Recent Execution Activity */}
      <div className="dashboard-grid-row two-col-split">
        <DashboardWatchlist trading={trading} />
        <RecentActivity
          orders={trading.orders}
          recentTrades={trading.recentTrades}
          prediction={trading.prediction}
          suggestion={trading.suggestion}
        />
      </div>

      {/* ROW 5: AI Forecast & Market Insights + Top Movers */}
      <div className="dashboard-grid-row two-col-balanced">
        <AIInsights
          prediction={trading.prediction}
          suggestion={trading.suggestion}
          watchlistDetails={trading.watchlistDetails}
        />
        <TopMovers watchlistDetails={trading.watchlistDetails} />
      </div>

      {/* ROW 6: Trader Discipline & Risk Habits */}
      <div className="dashboard-grid-row single-col">
        <DisciplineWidget trading={trading} />
      </div>
    </div>
  );
}

export default DashboardPage;
