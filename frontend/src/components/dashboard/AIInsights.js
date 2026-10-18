import React from 'react';

function AIInsights({ prediction, suggestion, watchlistDetails = [] }) {
  const sorted = [...watchlistDetails].sort((a, b) => Number(b.changePercent || 0) - Number(a.changePercent || 0));
  const best = sorted[0];
  const worst = sorted.at(-1);
  const action = suggestion?.action || prediction?.prediction || prediction?.signal || 'Observe';
  const rawConfidence = Number(suggestion?.confidence || prediction?.confidence || 0);
  const confidence = rawConfidence > 0 && rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;

  const signal = prediction?.signal || prediction?.trend || null;
  const expectedReturn = prediction?.expected_return_21d !== undefined && prediction?.expected_return_21d !== null
    ? Number(prediction.expected_return_21d) * 100
    : null;

  return (
    <section className="dashboard-section ai-insight-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI intelligence</p>
          <h3>Model desk note</h3>
        </div>
        <div className="insight-chips-group">
          {signal ? (
            <span className={`status-chip signal-chip ${String(signal).toLowerCase()}`}>
              21D: {signal}
            </span>
          ) : null}
          <span className="status-chip action-chip">{action}</span>
        </div>
      </div>

      <div className="ai-insight-main">
        <div className="ai-insight-content">
          <span className="ai-insight-label">Platform Execution View</span>
          <strong className="ai-insight-action-title">{action}</strong>
          <small className="ai-insight-desc">
            {suggestion?.reason || suggestion?.message || 'Multi-factor quantitative models continuously evaluate price dispersion and financial health.'}
          </small>
          {expectedReturn !== null ? (
            <div className="ai-forecast-inline-badge">
              <span>Expected 21D Return:</span>
              <strong className={expectedReturn >= 0 ? 'text-positive' : 'text-negative'}>
                {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(2)}%
              </strong>
            </div>
          ) : null}
        </div>
        <div className="confidence-ring" style={{ '--confidence': `${Math.max(0, Math.min(100, confidence))}%` }}>
          <strong>{confidence ? `${confidence.toFixed(0)}%` : '--'}</strong>
          <span>Confidence</span>
        </div>
      </div>

      <div className="ai-insight-grid">
        <div>
          <span>Market sentiment</span>
          <strong>{sorted.length && Number(best?.changePercent || 0) >= Math.abs(Number(worst?.changePercent || 0)) ? 'Constructive' : 'Cautious'}</strong>
        </div>
        <div>
          <span>Best performer</span>
          <strong>{best?.symbol || '--'}</strong>
        </div>
        <div>
          <span>Worst performer</span>
          <strong>{worst?.symbol || '--'}</strong>
        </div>
      </div>
    </section>
  );
}

export default AIInsights;
