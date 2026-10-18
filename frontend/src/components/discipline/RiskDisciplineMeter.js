import React from 'react';

function RiskDisciplineMeter({ riskMetrics, positions = [] }) {
  const {
    maxConcentration,
    highestPositionSymbol,
    isConcentrationSafe,
    cashReserveRatio,
    isLiquiditySafe,
    limitOrders,
    totalOrders,
    limitOrderRatio,
    isExecutionDisciplined,
    sectorsCount,
    isDiversified
  } = riskMetrics;

  return (
    <section className="card risk-discipline-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Risk Architecture</span>
          <h3>Risk Limits & Execution Quality</h3>
          <p className="section-subtext">Verified against your real holdings, orders, and portfolio allocation.</p>
        </div>
      </div>

      <div className="risk-meters-grid">
        {/* 1. Concentration Limit */}
        <div className="risk-meter-box">
          <div className="meter-head">
            <div>
              <span className="meter-title">Position Concentration</span>
              <small className="meter-caption">
                {highestPositionSymbol ? `Largest: ${highestPositionSymbol}` : 'No active holdings'}
              </small>
            </div>
            <span className={`meter-status-pill ${isConcentrationSafe ? 'safe' : 'alert'}`}>
              {maxConcentration.toFixed(1)}% / 25% Max
            </span>
          </div>

          <div className="meter-bar-track">
            <div
              className={`meter-bar-fill ${isConcentrationSafe ? 'safe-fill' : 'alert-fill'}`}
              style={{ width: `${Math.min(100, (maxConcentration / 25) * 100)}%` }}
            />
          </div>

          <p className="meter-rule-text">
            <strong>Rule:</strong> No single asset may exceed 25% of total portfolio equity. Protects against idiosyncratic corporate shocks.
          </p>
        </div>

        {/* 2. Cash Liquidity Buffer */}
        <div className="risk-meter-box">
          <div className="meter-head">
            <div>
              <span className="meter-title">Liquidity Buffer</span>
              <small className="meter-caption">Unallocated capital reserves</small>
            </div>
            <span className={`meter-status-pill ${isLiquiditySafe ? 'safe' : 'alert'}`}>
              {cashReserveRatio.toFixed(1)}% / 15% Target
            </span>
          </div>

          <div className="meter-bar-track">
            <div
              className={`meter-bar-fill ${isLiquiditySafe ? 'safe-fill' : 'warning-fill'}`}
              style={{ width: `${Math.min(100, (cashReserveRatio / 30) * 100)}%` }}
            />
          </div>

          <p className="meter-rule-text">
            <strong>Rule:</strong> Keep at least 15% cash unallocated. Prevents margin distress and funds opportunistic limit orders during pullbacks.
          </p>
        </div>

        {/* 3. Execution Discipline */}
        <div className="risk-meter-box">
          <div className="meter-head">
            <div>
              <span className="meter-title">Limit Order Discipline</span>
              <small className="meter-caption">Price certainty vs. market chasing</small>
            </div>
            <span className={`meter-status-pill ${isExecutionDisciplined ? 'safe' : 'warning'}`}>
              {limitOrders} of {totalOrders || 0} Limit Orders
            </span>
          </div>

          <div className="meter-bar-track">
            <div
              className={`meter-bar-fill ${isExecutionDisciplined ? 'safe-fill' : 'warning-fill'}`}
              style={{ width: `${totalOrders > 0 ? limitOrderRatio : 100}%` }}
            />
          </div>

          <p className="meter-rule-text">
            <strong>Rule:</strong> Target ≥ 70% limit order executions to eliminate spread slippage and prevent FOMO market execution.
          </p>
        </div>

        {/* 4. Sector Diversification */}
        <div className="risk-meter-box">
          <div className="meter-head">
            <div>
              <span className="meter-title">Sector Breadth</span>
              <small className="meter-caption">Macroeconomic independence</small>
            </div>
            <span className={`meter-status-pill ${isDiversified ? 'safe' : 'neutral'}`}>
              {sectorsCount} Active Sectors
            </span>
          </div>

          <div className="meter-bar-track">
            <div
              className="meter-bar-fill safe-fill"
              style={{ width: `${Math.min(100, (sectorsCount / 3) * 100)}%` }}
            />
          </div>

          <p className="meter-rule-text">
            <strong>Rule:</strong> Diversify across uncorrelated economic sectors to insulate portfolio value against cyclical sector downturns.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RiskDisciplineMeter;

