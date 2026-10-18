import React, { useMemo, useState } from 'react';
import PositionsTable from '../components/PositionsTable';
import { formatINR } from '../constants';

function PositionsPage({ trading }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (typeof trading.fetchPositions === 'function') {
        await trading.fetchPositions();
      }
      if (typeof trading.fetchPortfolio === 'function') {
        await trading.fetchPortfolio();
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  // Compute portfolio position statistics
  const stats = useMemo(() => {
    const posList = trading?.positions || [];
    let totalInvested = 0;
    let totalMarketValue = 0;
    let hasAnyCostBasis = false;

    posList.forEach((pos) => {
      const quantity = Number(pos.quantity || 0);
      const avgPrice = Number(pos.avgPrice ?? pos.averagePrice ?? 0);
      const marketPrice = Number(pos.marketPrice || avgPrice || 0);
      const val = Number(pos.marketValue ?? (quantity * marketPrice));
      totalMarketValue += val;

      if (avgPrice > 0) {
        const inv = Number(pos.invested ?? (quantity * avgPrice));
        if (inv > 0) {
          totalInvested += inv;
          hasAnyCostBasis = true;
        }
      }
    });

    const netPnl = hasAnyCostBasis ? totalMarketValue - totalInvested : null;
    const netPnlPercent = hasAnyCostBasis && totalInvested > 0 ? (netPnl / totalInvested) * 100 : null;
    const isNetPositive = netPnl !== null ? netPnl >= 0 : true;

    return {
      totalInvested,
      totalMarketValue,
      netPnl,
      netPnlPercent,
      isNetPositive,
      hasAnyCostBasis,
      count: posList.length
    };
  }, [trading?.positions]);

  return (
    <div className="page positions-page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Portfolio Holdings</p>
          <h2>Positions Terminal</h2>
          <p className="page-subtext">
            Track active market holdings, real cost basis, current valuations, and live instrument P&L.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="secondary-button refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh positions data"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh Positions'}
          </button>
        </div>
      </div>

      {/* SUMMARY METRIC STRIP */}
      <div className="positions-summary-strip" role="region" aria-label="Portfolio holdings summary">
        <div className="card position-metric-card">
          <span className="metric-label">Holdings Value</span>
          <strong className="metric-val text-primary tabular-nums">
            {formatINR(stats.totalMarketValue)}
          </strong>
          <span className="metric-note">Current market valuation</span>
        </div>

        <div className="card position-metric-card">
          <span className="metric-label">Invested Capital</span>
          <strong className="metric-val tabular-nums">
            {stats.hasAnyCostBasis ? formatINR(stats.totalInvested) : '—'}
          </strong>
          <span className="metric-note">
            {stats.hasAnyCostBasis ? 'Acquisition cost basis' : 'Awaiting cost basis sync'}
          </span>
        </div>

        <div className="card position-metric-card">
          <span className="metric-label">Unrealized P&L</span>
          <div className="metric-val-with-pill">
            <strong className={`metric-val tabular-nums ${stats.isNetPositive ? 'text-positive' : 'text-negative'}`}>
              {stats.netPnl !== null ? `${stats.isNetPositive ? '+' : ''}${formatINR(stats.netPnl)}` : '—'}
            </strong>
            {stats.netPnlPercent !== null && (
              <span className={`metric-pill ${stats.isNetPositive ? 'pill-positive' : 'pill-negative'}`}>
                {stats.isNetPositive ? '+' : ''}{stats.netPnlPercent.toFixed(2)}%
              </span>
            )}
          </div>
          <span className="metric-note">Net floating profit/loss</span>
        </div>

        <div className="card position-metric-card">
          <span className="metric-label">Active Holdings</span>
          <strong className="metric-val tabular-nums">
            {stats.count}
          </strong>
          <span className="metric-note">
            {stats.count === 1 ? '1 Instrument held' : `${stats.count} Instruments held`}
          </span>
        </div>
      </div>

      {/* POSITIONS TABLE */}
      <PositionsTable
        positions={trading.positions}
        selectAsset={trading.selectAsset}
      />
    </div>
  );
}

export default PositionsPage;
