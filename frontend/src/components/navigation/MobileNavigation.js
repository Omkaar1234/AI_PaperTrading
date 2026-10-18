import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavIcon } from './Sidebar';

const mobileNavLinks = [
  { to: '/dashboard', label: 'Dashboard', iconType: 'dashboard' },
  { to: '/market', label: 'Markets', iconType: 'markets' },
  { to: '/trade', label: 'Trade', iconType: 'trade' },
  { to: '/orders', label: 'Orders', iconType: 'orders' },
  { to: '/positions', label: 'Holdings', iconType: 'portfolio' },
  { to: '/prediction', label: 'AI', iconType: 'prediction' },
  { to: '/discipline', label: 'Discipline', iconType: 'discipline' }
];

function MobileNavigation() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {mobileNavLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <NavIcon type={link.iconType} />
          </span>
          <span className="mobile-nav-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileNavigation;

