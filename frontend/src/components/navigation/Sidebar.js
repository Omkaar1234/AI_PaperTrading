import React from 'react';
import { NavLink } from 'react-router-dom';
import { formatINR } from '../../constants';
import { Tooltip } from '../ui';

export function NavIcon({ type }) {
  switch (type) {
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'markets':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      );
    case 'trade':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case 'orderbook':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'orders':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'portfolio':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'prediction':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        </svg>
      );
    case 'discipline':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return null;
  }
}

const primaryLinks = [
  { to: '/dashboard', label: 'Dashboard', iconType: 'dashboard', description: 'Account pulse' },
  { to: '/market', label: 'Markets', iconType: 'markets', description: 'NSE universe' },
  { to: '/trade', label: 'Trade', iconType: 'trade', description: 'Execution terminal' },
  { to: '/orderbook', label: 'Order Book', iconType: 'orderbook', description: 'Market depth' },
  { to: '/orders', label: 'Orders', iconType: 'orders', description: 'Order history' },
  { to: '/positions', label: 'Portfolio', iconType: 'portfolio', description: 'Holdings' },
  { to: '/prediction', label: 'AI Analysis', iconType: 'prediction', description: 'Model signals' },
  { to: '/discipline', label: 'Discipline', iconType: 'discipline', description: 'Habits & Academy' }
];

function Sidebar({ collapsed, onToggle, totalPortfolioValue, user, authUser }) {
  const availableCash = user?.balance || 0;

  return (
    <aside className={`platform-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-inner">
        <div className="brand-lockup">
          <div className="brand-symbol" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div className="brand-copy">
            <strong>UPRISE</strong>
            <span>Practice. Analyze. Grow.</span>
          </div>
        </div>

        <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            <span aria-hidden="true">{collapsed ? '→' : '←'}</span>
          </button>
        </Tooltip>

        <nav className="sidebar-link-stack">
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={collapsed ? link.label : undefined}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <NavIcon type={link.iconType} />
              </span>
              <span className="sidebar-link-copy">
                <strong>{link.label}</strong>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account-card" aria-label="Account summary">
          <div className="sidebar-account-row">
            <span className="account-card-label">Portfolio Value</span>
            <strong className="account-card-value">{formatINR(totalPortfolioValue)}</strong>
          </div>
          <div className="sidebar-cash-row">
            <span>Available Cash</span>
            <strong>{formatINR(availableCash)}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
