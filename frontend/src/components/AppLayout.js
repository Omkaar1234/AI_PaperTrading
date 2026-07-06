import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { formatINR } from '../constants';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/dashboard': {
    eyebrow: 'Portfolio overview',
    title: 'Dashboard',
    description: 'Summary of account value, watchlist movers, and recent execution activity.'
  },
  '/market': {
    eyebrow: 'Indian equities',
    title: 'Market',
    description: 'Browse large-cap Indian stocks with search and sector filters.'
  },
  '/trade': {
    eyebrow: 'Execution workspace',
    title: 'Trade Terminal',
    description: 'Chart, watchlist, order ticket, and position monitor in one trading workflow.'
  },
  '/orders': {
    eyebrow: 'Execution history',
    title: 'Orders',
    description: 'Review placed orders and their fill status.'
  },
  '/positions': {
    eyebrow: 'Holdings',
    title: 'Positions',
    description: 'Track open positions and jump into an asset when needed.'
  },
  '/prediction': {
    eyebrow: 'ML workspace',
    title: 'Prediction',
    description: 'Run model predictions and decision suggestions for the selected asset.'
  }
};

function AppLayout({ trading }) {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META['/trade'];

  return (
    <div className="app-shell">
      <Sidebar user={trading.user} totalPortfolioValue={trading.getTotalPortfolioValue()} />

      <div className="app-content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <h1>{meta.title}</h1>
            <p className="topbar-copy">{meta.description}</p>
          </div>

          <div className="topbar-actions">
            <div className="pill">
              <span>Cash Balance</span>
              <strong>{formatINR(trading.user?.balance || 0)}</strong>
            </div>
            <div className="pill">
              <span>Tracked Asset</span>
              <strong>{trading.selectedAsset?.symbol || '--'}</strong>
            </div>
            <div className="pill">
              <span>Last Price</span>
              <strong>{formatINR(trading.assetInfo?.currentPrice || trading.selectedAsset?.price || 0)}</strong>
            </div>
            <button className="secondary-button" onClick={trading.refreshMarketData}>
              Refresh Market
            </button>
          </div>
        </header>

        {trading.tradeSuccess && (
          <div className={`banner banner-${trading.tradeSuccess.type}`}>
            {trading.tradeSuccess.message}
          </div>
        )}

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
