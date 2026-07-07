import React from 'react';
import { useNavigate } from 'react-router-dom';

const ACTIONS = [
  { label: 'Trade', route: '/trade', icon: 'TR' },
  { label: 'Markets', route: '/market', icon: 'MK' },
  { label: 'Portfolio', route: '/positions', icon: 'PF' },
  { label: 'AI Analysis', route: '/prediction', icon: 'AI' },
  { label: 'Orders', route: '/orders', icon: 'OR' }
];

function QuickActions() {
  const navigate = useNavigate();

  return (
    <section className="dashboard-section quick-actions-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Quick actions</p>
          <h3>Next move</h3>
        </div>
      </div>
      <div className="quick-action-grid">
        {ACTIONS.map((action) => (
          <button type="button" key={action.route} onClick={() => navigate(action.route)}>
            <span>{action.icon}</span>
            <strong>{action.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

export default QuickActions;
