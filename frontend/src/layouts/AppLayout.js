import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PageFrame from '../components/layout/PageFrame';
import Sidebar from '../components/navigation/Sidebar';
import TopNavigation from '../components/navigation/TopNavigation';
import MobileNavigation from '../components/navigation/MobileNavigation';

const PAGE_META = {
  '/dashboard': {
    eyebrow: 'Portfolio overview',
    title: 'Dashboard',
    description: 'Account value, available capital, and recent execution activity at a glance.'
  },
  '/market': {
    eyebrow: 'Indian equities',
    title: 'Markets',
    description: 'Scan the Indian stock universe and move quickly from discovery to execution.'
  },
  '/trade': {
    eyebrow: 'Execution workspace',
    title: 'Trade Terminal',
    description: 'A focused trading surface for chart review, order entry, and position monitoring.'
  },
  '/orderbook': {
    eyebrow: 'Market microstructure',
    title: 'Order Book',
    description: 'Live bid and ask depth for understanding liquidity before placing simulated orders.'
  },
  '/orders': {
    eyebrow: 'Execution history',
    title: 'Orders',
    description: 'Review submitted orders, statuses, and cancellation actions.'
  },
  '/positions': {
    eyebrow: 'Portfolio holdings',
    title: 'Portfolio',
    description: 'Track simulated holdings, market value, and instrument-level exposure.'
  },
  '/prediction': {
    eyebrow: 'AI decision support',
    title: 'AI Analysis',
    description: 'Run model-assisted analysis and translate signals into beginner-friendly actions.'
  }
};

function AppLayout({ trading, auth }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const meta = PAGE_META[location.pathname] || PAGE_META['/trade'];

  return (
    <div className={`app-shell premium-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        totalPortfolioValue={trading.getTotalPortfolioValue()}
        user={trading.user}
        authUser={auth.user}
        onLogout={auth.logout}
      />

      <div className="workspace-shell">
        <TopNavigation meta={meta} trading={trading} auth={auth} />
        <PageFrame tradeSuccess={trading.tradeSuccess}>
          <Outlet />
        </PageFrame>
      </div>

      <MobileNavigation />
    </div>
  );
}

export default AppLayout;
