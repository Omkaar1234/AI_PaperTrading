import React from 'react';

function DisciplineHeader({ riskMetrics, completedLessonsCount, totalLessonsCount }) {
  const { score, level, isConcentrationSafe, maxConcentration, cashReserveRatio, isLiquiditySafe, limitOrderRatio, isExecutionDisciplined } = riskMetrics;

  return (
    <section className="card discipline-header-card">
      {/* Responsible engagement institutional notice */}
      <div className="discipline-notice-banner">
        <span className="notice-icon">🛡️</span>
        <div className="notice-text">
          <strong>UPRISE Responsible Engagement Framework:</strong> We evaluate capital preservation, risk limits, execution discipline, and learning progress. We never reward trading volume, reckless turnover, or gambling habits.
        </div>
      </div>

      <div className="discipline-header-main">
        <div className="discipline-score-block">
          <span className="eyebrow">Discipline & Learning Index</span>
          <div className="discipline-score-row">
            <div className="discipline-gauge" style={{ '--score': `${score}%` }}>
              <span className="score-number">{score}</span>
              <span className="score-max">/100</span>
            </div>
            <div className="discipline-tier-info">
              <h3 className="discipline-tier-title">{level}</h3>
              <p className="discipline-tier-desc">
                Derived from real portfolio risk limits, limit order usage, cash buffer adequacy, and completed coursework.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Core Pillars Summary */}
        <div className="discipline-pillars-grid">
          <div className={`pillar-metric-card ${isConcentrationSafe ? 'safe' : 'caution'}`}>
            <span className="pillar-label">Max Position Size</span>
            <strong className="pillar-val">{maxConcentration > 0 ? `${maxConcentration.toFixed(1)}%` : '0%'}</strong>
            <small className="pillar-rule">Target: ≤ 25.0%</small>
          </div>

          <div className={`pillar-metric-card ${isLiquiditySafe ? 'safe' : 'caution'}`}>
            <span className="pillar-label">Cash Buffer</span>
            <strong className="pillar-val">{cashReserveRatio.toFixed(1)}%</strong>
            <small className="pillar-rule">Target: ≥ 15.0%</small>
          </div>

          <div className={`pillar-metric-card ${isExecutionDisciplined ? 'safe' : 'caution'}`}>
            <span className="pillar-label">Limit Order Ratio</span>
            <strong className="pillar-val">{limitOrderRatio.toFixed(0)}%</strong>
            <small className="pillar-rule">Target: ≥ 70.0%</small>
          </div>

          <div className="pillar-metric-card neutral">
            <span className="pillar-label">Coursework</span>
            <strong className="pillar-val">{completedLessonsCount} / {totalLessonsCount}</strong>
            <small className="pillar-rule">Core Lessons</small>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DisciplineHeader;

