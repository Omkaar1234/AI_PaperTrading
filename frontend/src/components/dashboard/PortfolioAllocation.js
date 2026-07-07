import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatINR } from '../../constants';
import { getAssetTypeLabel, getPositionMarketValue } from './dashboardUtils';

const COLORS = ['#4f8cff', '#7c5cff', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8'];

function groupPositions(positions, marketQuotes, mode) {
  const groups = {};
  positions.forEach((position) => {
    const quote = marketQuotes[position.symbol];
    const value = getPositionMarketValue(position, quote);
    const directoryType = position.assetType;
    let key = 'Equity';

    if (mode === 'asset') {
      key = getAssetTypeLabel(directoryType);
    } else if (mode === 'cap') {
      key = value > 200000 ? 'Large cap' : value > 75000 ? 'Mid cap' : 'Small cap';
    } else {
      key = position.sector || inferSector(position.symbol);
    }

    groups[key] = (groups[key] || 0) + value;
  });

  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

function inferSector(symbol = '') {
  if (/BANK|HDFC|ICICI|SBIN|AXIS/i.test(symbol)) {
    return 'Financials';
  }
  if (/TCS|INFY|WIPRO|TECH/i.test(symbol)) {
    return 'Technology';
  }
  if (/RELIANCE|ONGC|OIL/i.test(symbol)) {
    return 'Energy';
  }
  return 'Diversified';
}

function PortfolioAllocation({ positions, marketQuotes }) {
  const [mode, setMode] = useState('sector');
  const data = useMemo(() => groupPositions(positions, marketQuotes, mode), [marketQuotes, mode, positions]);

  return (
    <section className="dashboard-section allocation-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Allocation</p>
          <h3>Portfolio mix</h3>
        </div>
        <div className="mini-segments">
          {[
            { label: 'Sector', value: 'sector' },
            { label: 'Cap', value: 'cap' },
            { label: 'Type', value: 'asset' }
          ].map((item) => (
            <button key={item.value} type="button" className={mode === item.value ? 'active' : ''} onClick={() => setMode(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {data.length ? (
        <div className="allocation-content">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatINR(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="allocation-legend">
            {data.map((entry, index) => (
              <div key={entry.name}>
                <span style={{ background: COLORS[index % COLORS.length] }} />
                <strong>{entry.name}</strong>
                <small>{formatINR(entry.value)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-panel">Place your first simulated trade to build allocation data.</div>
      )}
    </section>
  );
}

export default PortfolioAllocation;
