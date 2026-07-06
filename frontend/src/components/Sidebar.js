import React from 'react';
import { NavLink } from 'react-router-dom';
import { formatINR } from '../constants';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/market', label: 'Market' },
  { to: '/trade', label: 'Trade' },
  { to: '/orders', label: 'Orders' },
  { to: '/positions', label: 'Positions' },
  { to: '/prediction', label: 'Prediction' }
];

function Sidebar({ user, totalPortfolioValue }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">PT</div>
        <div>
          <p className="eyebrow">Multi-page terminal</p>
          <h2>PaperTrade Pro</h2>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-summary">
        <div className="summary-tile">
          <span>Portfolio Value</span>
          <strong>{formatINR(totalPortfolioValue)}</strong>
        </div>
        <div className="summary-tile">
          <span>Buying Power</span>
          <strong>{formatINR(user?.balance || 0)}</strong>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
