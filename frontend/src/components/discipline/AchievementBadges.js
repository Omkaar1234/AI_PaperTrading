import React, { useState } from 'react';

function AchievementBadges({ badges = [] }) {
  const [filter, setFilter] = useState('all');

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const filteredBadges = badges.filter((b) => {
    if (filter === 'unlocked') return b.unlocked;
    if (filter === 'locked') return !b.unlocked;
    return true;
  });

  return (
    <section className="card achievement-badges-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Verifiable Milestones</span>
          <h3>Discipline & Risk Badges</h3>
          <p className="section-subtext">
            Awarded strictly for adherence to risk limits, educational completion, and execution habits. No badges for trade volume or lucky profits.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="badge-filter-group" role="tablist" aria-label="Badge filter">
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({badges.length})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'unlocked' ? 'active' : ''}`}
            onClick={() => setFilter('unlocked')}
          >
            Unlocked ({unlockedCount})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === 'locked' ? 'active' : ''}`}
            onClick={() => setFilter('locked')}
          >
            In Progress ({badges.length - unlockedCount})
          </button>
        </div>
      </div>

      <div className="badges-grid">
        {filteredBadges.map((badge) => (
          <article
            key={badge.id}
            className={`badge-card ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}
          >
            <div className="badge-card-header">
              <div className="badge-icon-shell">
                <span className="badge-emoji" role="img" aria-label={badge.name}>
                  {badge.icon}
                </span>
              </div>
              <span className={`badge-status-tag ${badge.unlocked ? 'unlocked' : 'locked'}`}>
                {badge.unlocked ? 'Unlocked' : 'In Progress'}
              </span>
            </div>

            <div className="badge-card-body">
              <span className="badge-category">{badge.category}</span>
              <h4 className="badge-name">{badge.name}</h4>
              <p className="badge-desc">{badge.description}</p>
            </div>

            <div className="badge-card-footer">
              <div className="badge-criteria-line">
                <span className="criteria-label">Rule:</span>
                <span className="criteria-val">{badge.criteria}</span>
              </div>
              <div className="badge-progress-line">
                <span className="progress-label">Status:</span>
                <span className="progress-val">{badge.progress}</span>
              </div>
              {badge.unlocked && (
                <div className="badge-verified-note">
                  <span className="verified-check">✓</span>
                  <span>{badge.unlockedNotice}</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AchievementBadges;

