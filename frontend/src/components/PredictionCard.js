import React from 'react';

function PredictionCard({ analyzing, analyzeAsset, prediction, selectedAsset, suggestion }) {
  const action = suggestion?.action?.toLowerCase() || 'hold';

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI signal</p>
          <h3>Prediction Engine</h3>
        </div>
        <button className="primary-button" onClick={analyzeAsset} disabled={analyzing || !selectedAsset}>
          {analyzing ? 'Analyzing...' : `Analyze ${selectedAsset?.symbol || ''}`}
        </button>
      </div>

      {prediction ? (
        <div className={`signal-card ${action}`}>
          <div className="signal-header">
            <span>Trend</span>
            <strong>{prediction.trend}</strong>
          </div>
          <div className="signal-main">{suggestion?.action || 'HOLD'}</div>
          <p>Confidence: {(prediction.confidence * 100).toFixed(1)}%</p>
        </div>
      ) : (
        <div className="empty-panel">Click on ANALYZE to get predictions.</div>
      )}
    </section>
  );
}

export default PredictionCard;
