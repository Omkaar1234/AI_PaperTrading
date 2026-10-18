import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../constants';

function PositionsTable({ positions = [], selectAsset, embedded = false }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value'); // 'value' | 'pnl' | 'symbol'

  const normalizedPositions = useMemo(() => {
    return positions.map((position) => {
      const quantity = Number(position.quantity || 0);
      const hasAvg = position.avgPrice !== null && position.avgPrice !== undefined && Number(position.avgPrice) > 0;
      const avgPrice = hasAvg ? Number(position.avgPrice) : (Number(position.averagePrice || 0) > 0 ? Number(position.averagePrice) : null);
      
      const hasInvested = position.invested !== null && position.invested !== undefined && Number(position.invested) > 0;
      const invested = hasInvested ? Number(position.invested) : (avgPrice !== null ? quantity * avgPrice : null);
      
      const marketPrice = Number(position.marketPrice || avgPrice || 0);
      const marketValue = Number(position.marketValue ?? (quantity * marketPrice));
      
      const hasCostBasis = avgPrice !== null && invested !== null && invested > 0;
      const pnl = hasCostBasis ? Number(position.unrealizedPnl ?? (marketValue - invested)) : null;
      const pnlPercent = hasCostBasis && invested > 0 ? (pnl / invested) * 100 : null;
      const isProfit = pnl !== null ? pnl >= 0 : null;

      return {
        ...position,
        quantity,
        avgPrice,
        marketPrice,
        invested,
        marketValue,
        pnl,
        pnlPercent,
        isProfit,
        hasCostBasis
      };
    });
  }, [positions]);

  const filteredPositions = useMemo(() => {
    let result = normalizedPositions;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => p.symbol.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'pnl') {
        return (Number(b.pnl || 0)) - (Number(a.pnl || 0));
      }
      if (sortBy === 'symbol') {
        return a.symbol.localeCompare(b.symbol);
      }
      return b.marketValue - a.marketValue;
    });
  }, [normalizedPositions, searchQuery, sortBy]);

  const handleTrade = async (position) => {
    if (selectAsset) {
      await selectAsset({
        symbol: position.symbol,
        name: position.symbol,
        price: position.marketPrice || position.avgPrice || 0
      });
    }
    navigate('/trade');
  };

  const handlePredict = async (position) => {
    if (selectAsset) {
      await selectAsset({
        symbol: position.symbol,
        name: position.symbol,
        price: position.marketPrice || position.avgPrice || 0
      });
    }
    navigate('/prediction');
  };

  return (
    <section className={embedded ? 'positions-embedded-wrap' : 'card positions-terminal-card'}>
      {!embedded && (
        <div className="section-heading positions-heading-row">
          <div>
            <p className="eyebrow">Portfolio Holdings</p>
            <h3 className="positions-title">Active Market Positions</h3>
          </div>
          <div className="positions-controls-row">
            {positions.length > 3 && (
              <div className="positions-search-box">
                <input
                  type="text"
                  placeholder="Filter symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="table-search-input"
                  aria-label="Filter positions by symbol"
                />
              </div>
            )}
            {positions.length > 0 && (
              <span className="badge-text neutral-badge">
                {positions.length} {positions.length === 1 ? 'Holding' : 'Holdings'}
              </span>
            )}
          </div>
        </div>
      )}

      {filteredPositions.length ? (
        <div className="ui-table-wrap">
          <table className="ui-table semantic-table positions-table">
            <thead>
              <tr>
                <th className="text-left">
                  <button type="button" className="th-sort-btn" onClick={() => setSortBy('symbol')}>
                    Symbol {sortBy === 'symbol' ? '↓' : ''}
                  </button>
                </th>
                <th className="text-center">Side</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Avg Price</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Invested</th>
                <th className="text-right">
                  <button type="button" className="th-sort-btn" onClick={() => setSortBy('value')}>
                    Current Value {sortBy === 'value' ? '↓' : ''}
                  </button>
                </th>
                <th className="text-right">
                  <button type="button" className="th-sort-btn" onClick={() => setSortBy('pnl')}>
                    Unrealized P&L {sortBy === 'pnl' ? '↓' : ''}
                  </button>
                </th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((position) => {
                return (
                  <tr key={position.symbol} className="position-row">
                    <td className="text-left font-medium">
                      <div className="position-symbol-cell">
                        <strong className="symbol-ticker">{position.symbol}</strong>
                        {position.assetType && (
                          <span className="asset-type-subtext">{position.assetType}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="order-badge order-badge-buy" title="Long exposure">
                        LONG
                      </span>
                    </td>
                    <td className="text-right tabular-nums font-semibold">{position.quantity}</td>
                    <td className="text-right tabular-nums">
                      {position.hasCostBasis ? (
                        formatINR(position.avgPrice)
                      ) : (
                        <span className="text-muted" title="Cost basis not recorded or unavailable">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums font-medium">{formatINR(position.marketPrice)}</td>
                    <td className="text-right tabular-nums">
                      {position.hasCostBasis ? (
                        formatINR(position.invested)
                      ) : (
                        <span className="text-muted" title="Invested capital unavailable without cost basis">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums font-semibold">{formatINR(position.marketValue)}</td>
                    <td className="text-right tabular-nums">
                      {position.hasCostBasis && position.pnl !== null ? (
                        <div className="pnl-compound-cell">
                          <span className={`pnl-val font-semibold ${position.isProfit ? 'text-positive' : 'text-negative'}`}>
                            {position.isProfit ? '+' : ''}{formatINR(position.pnl)}
                          </span>
                          <span className={`metric-pill ${position.isProfit ? 'pill-positive' : 'pill-negative'}`}>
                            {position.isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <div className="pnl-compound-cell">
                          <span className="text-muted">—</span>
                          <span className="metric-pill pill-neutral" title="Unrealized P&L cannot be calculated without cost basis">
                            Unavail
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="positions-action-btn-group">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => handleTrade(position)}
                          title={`Place order for ${position.symbol}`}
                        >
                          Trade
                        </button>
                        <button
                          type="button"
                          className="secondary-button table-action-secondary"
                          onClick={() => handlePredict(position)}
                          title={`Run AI prediction on ${position.symbol}`}
                        >
                          AI
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-panel">
          {positions.length === 0
            ? 'No open positions in your portfolio yet. Execute a trade in the Trade Terminal to build your portfolio.'
            : `No holdings match "${searchQuery}".`}
        </div>
      )}
    </section>
  );
}

export default PositionsTable;
