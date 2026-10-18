import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatINR } from '../../constants';
import { getAssetTypeLabel, getPositionMarketValue } from './dashboardUtils';

const COLORS = ['#38bdf8', '#818cf8', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const CASH_COLOR = '#10b981';

function groupPositions(positions, marketQuotes, mode, cashBalance) {
  const groups = {};
  let totalEquityValue = 0;

  positions.forEach((position) => {
    const quote = marketQuotes[position.symbol];
    const value = getPositionMarketValue(position, quote);
    totalEquityValue += value;
    const directoryType = position.assetType;
    let key = 'Equity';

    if (mode === 'asset') {
      key = getAssetTypeLabel(directoryType);
    } else if (mode === 'cap') {
      key = value > 200000 ? 'Large Cap' : value > 75000 ? 'Mid Cap' : 'Small Cap';
    } else {
      key = position.sector || inferSector(position.symbol);
    }

    groups[key] = (groups[key] || 0) + value;
  });

  const list = Object.entries(groups).map(([name, value], index) => ({
    name,
    value,
    color: COLORS[index % COLORS.length],
    isCash: false
  }));

  const cashVal = Number(cashBalance || 0);
  if (cashVal > 0) {
    list.unshift({
      name: 'Cash Reserve',
      value: cashVal,
      color: CASH_COLOR,
      isCash: true
    });
  }

  const grandTotal = totalEquityValue + Math.max(0, cashVal);
  return {
    items: list.map((item) => ({
      ...item,
      percent: grandTotal > 0 ? ((item.value / grandTotal) * 100).toFixed(1) : 0
    })),
    grandTotal
  };
}

function inferSector(symbol = '') {
  if (/BANK|HDFC|ICICI|SBIN|AXIS|KOTAK/i.test(symbol)) {
    return 'Financials';
  }
  if (/TCS|INFY|WIPRO|TECH|HCL/i.test(symbol)) {
    return 'Technology';
  }
  if (/RELIANCE|ONGC|OIL|BPCL|IOC/i.test(symbol)) {
    return 'Energy';
  }
  if (/LT|LARSEN|ABB|SIEMENS/i.test(symbol)) {
    return 'Industrials';
  }
  if (/BHARTI|AIRTEL|IDEA/i.test(symbol)) {
    return 'Telecom';
  }
  if (/AUTO|MARUTI|TATAMOTORS|M&M/i.test(symbol)) {
    return 'Automotive';
  }
  return 'Diversified';
}

function PortfolioAllocation({ positions = [], marketQuotes = {}, cashBalance = 0, totalPortfolioValue = null }) {
  const [mode, setMode] = useState('sector');
  const { items: data, grandTotal } = useMemo(
    () => groupPositions(positions, marketQuotes, mode, cashBalance),
    [marketQuotes, mode, positions, cashBalance]
  );

  const displayTotal = totalPortfolioValue !== null && totalPortfolioValue !== undefined
    ? totalPortfolioValue
    : grandTotal;

  return (
    <section className="dashboard-section allocation-panel card" aria-label="Portfolio asset allocation">
      <div className="section-heading allocation-heading-row">
        <div>
          <p className="eyebrow">Asset Distribution</p>
          <h3 className="allocation-title">Portfolio Mix</h3>
        </div>
        <div className="mini-segments" role="group" aria-label="Allocation grouping">
          {[
            { label: 'Sector', value: 'sector' },
            { label: 'Market Cap', value: 'cap' },
            { label: 'Asset Type', value: 'asset' }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={`segment-btn ${mode === item.value ? 'active' : ''}`}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {data.length ? (
        <div className="allocation-content-balanced">
          {/* COMPACT DOUGHNUT WITH CENTER TOTAL */}
          <div className="doughnut-container">
            <div className="doughnut-chart-wrapper">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatINR(value), 'Value']}
                    contentStyle={{
                      background: 'var(--card-bg, #1a202c)',
                      border: '1px solid var(--border-color, #2d3748)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="doughnut-center-overlay" aria-hidden="true">
                <span className="doughnut-center-subtext">Total Value</span>
                <strong className="doughnut-center-value tabular-nums">
                  {formatINR(displayTotal)}
                </strong>
              </div>
            </div>
          </div>

          {/* SIDE LEGEND */}
          <div className="allocation-side-legend" role="list" aria-label="Portfolio allocation slices">
            {data.map((entry) => (
              <div key={entry.name} className="legend-row" role="listitem">
                <span className="legend-color-dot" style={{ backgroundColor: entry.color }} />
                <div className="legend-info">
                  <div className="legend-title-line">
                    <strong className="legend-name">{entry.name}</strong>
                    <span className="legend-pct tabular-nums">{entry.percent}%</span>
                  </div>
                  <span className="legend-val text-muted tabular-nums">
                    {formatINR(entry.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-panel">
          Deposit funds or execute a simulated trade to generate asset allocation metrics.
        </div>
      )}
    </section>
  );
}

export default PortfolioAllocation;
