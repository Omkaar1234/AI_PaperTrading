import React from 'react';
import { Link } from 'react-router-dom';
import { calculateRiskDiscipline, getCompletedLessons, getJournalEntries } from '../discipline/disciplineUtils';

function DisciplineWidget({ trading }) {
  const completedLessons = getCompletedLessons();
  const journalEntries = getJournalEntries();
  const metrics = calculateRiskDiscipline(trading, completedLessons, journalEntries);

  return (
    <section className="dashboard-section discipline-dashboard-widget">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trader discipline</p>
          <h3>Habits & Risk Limits</h3>
        </div>
        <span className="status-chip discipline-score-chip">
          {metrics.score}/100 • {metrics.level}
        </span>
      </div>

      <div className="discipline-widget-body">
        <div className="discipline-widget-grid">
          <div className="discipline-widget-card">
            <span className="widget-metric-label">Max Position Size</span>
            <strong className={`widget-metric-val ${metrics.isConcentrationSafe ? 'text-positive' : 'text-negative'}`}>
              {metrics.maxConcentration.toFixed(1)}%
            </strong>
            <small>Threshold: ≤ 25.0%</small>
          </div>

          <div className="discipline-widget-card">
            <span className="widget-metric-label">Execution Quality</span>
            <strong className={`widget-metric-val ${metrics.isExecutionDisciplined ? 'text-positive' : 'text-primary'}`}>
              {metrics.limitOrderRatio.toFixed(0)}%
            </strong>
            <small>Limit orders used</small>
          </div>

          <div className="discipline-widget-card">
            <span className="widget-metric-label">Curriculum</span>
            <strong className="widget-metric-val">
              {completedLessons.length} / 6
            </strong>
            <small>Lessons completed</small>
          </div>
        </div>

        <div className="discipline-widget-footer">
          <p className="discipline-widget-note">
            UPRISE rewards process discipline, risk-awareness, and continuous learning — never reckless turnover or high leverage.
          </p>
          <Link to="/discipline" className="secondary-button view-discipline-link">
            Open Discipline Hub →
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DisciplineWidget;

