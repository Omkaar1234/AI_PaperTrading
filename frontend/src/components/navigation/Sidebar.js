import React from 'react';
import { NavLink } from 'react-router-dom';
import { formatINR } from '../../constants';
import { Tooltip } from '../ui';

const primaryLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: 'DB', description: 'Account pulse' },
  { to: '/market', label: 'Markets', icon: 'MK', description: 'NSE universe' },
  { to: '/trade', label: 'Trade', icon: 'TR', description: 'Execution terminal' },
  { to: '/orderbook', label: 'Order Book', icon: 'OB', description: 'Market depth' },
  { to: '/orders', label: 'Orders', icon: 'OR', description: 'Order history' },
  { to: '/positions', label: 'Portfolio', icon: 'PF', description: 'Holdings' },
  { to: '/prediction', label: 'AI Analysis', icon: 'AI', description: 'Model signals' }
];

function Sidebar({ collapsed, onToggle, totalPortfolioValue, user }) {
  const availableCash = user?.balance || 0;

  return (
    <aside className={`platform-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-inner">
        <div className="brand-lockup">
          <div className="brand-symbol" aria-hidden="true">
            AS
          </div>
          <div className="brand-copy">
            <span>NSE paper terminal</span>
            <strong>AlphaSim</strong>
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
            <span aria-hidden="true">{collapsed ? '>' : '<'}</span>
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
                {link.icon}
              </span>
              <span className="sidebar-link-copy">
                <strong>{link.label}</strong>
                <small>{link.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account-card" aria-label="Account summary">
          <span>Portfolio value</span>
          <strong>{formatINR(totalPortfolioValue)}</strong>
          <small>{formatINR(availableCash)} available cash</small>
          <div className="account-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(12, availableCash / 10000))}%` }} />
          </div>
        </div>

        <button type="button" className="sidebar-settings-button">
          <span className="sidebar-link-icon" aria-hidden="true">
            ST
          </span>
          <span className="sidebar-link-copy">
            <strong>Settings</strong>
            <small>Workspace preferences</small>
          </span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
