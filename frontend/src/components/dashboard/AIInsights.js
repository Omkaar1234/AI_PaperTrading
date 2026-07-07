import React from 'react';

function AIInsights({ prediction, suggestion, watchlistDetails }) {
  const sorted = [...watchlistDetails].sort((a, b) => Number(b.changePercent || 0) - Number(a.changePercent || 0));
  const best = sorted[0];
  const worst = sorted.at(-1);
  const action = suggestion?.action || prediction?.prediction || 'Observe';
  const confidence = Number(suggestion?.confidence || prediction?.confidence || 0);

  return (
    <section className="dashboard-section ai-insight-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI insights</p>
          <h3>Model desk note</h3>
        </div>
        <span className="status-chip">{action}</span>
      </div>

      <div className="ai-insight-main">
        <div>
          <span>Recommendation</span>
          <strong>{action}</strong>
          <small>Suggested action: {suggestion?.reason || suggestion?.message || 'Run analysis on a selected asset before entering a trade.'}</small>
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
