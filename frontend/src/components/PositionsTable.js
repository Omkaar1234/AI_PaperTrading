import React from 'react';
import { formatINR } from '../constants';

function PositionsTable({ positions = [], selectAsset, embedded = false }) {
  return (
    <section className={embedded ? '' : 'card'}>
      {!embedded && (
        <div className="section-heading">
          <div>
            <p className="eyebrow">Holdings</p>
            <h3>Open Positions</h3>
          </div>
          {positions.length > 0 && (
            <span className="badge-text neutral-badge">
              {positions.length} {positions.length === 1 ? 'Holding' : 'Holdings'}
            </span>
          )}
        </div>
      )}

      {positions.length ? (
        <div className="ui-table-wrap">
          <table className="ui-table semantic-table">
            <thead>
              <tr>
                <th className="text-left">Symbol</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Avg Price</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Invested</th>
                <th className="text-right">Current Value</th>
                <th className="text-right">P&L (₹)</th>
                <th className="text-right">P&L (%)</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const quantity = Number(position.quantity || 0);
                const avgPrice = Number(position.avgPrice ?? position.averagePrice ?? 0);
                const marketPrice = Number(position.marketPrice || avgPrice || 0);
                const invested = Number(position.invested ?? (quantity * avgPrice));
                const marketValue = Number(position.marketValue ?? (quantity * marketPrice));
                const pnl = Number(position.unrealizedPnl ?? (marketValue - invested));
                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                const isProfit = pnl >= 0;

                return (
                  <tr key={position.symbol}>
                    <td className="text-left font-medium">
                      <strong>{position.symbol}</strong>
                    </td>
                    <td className="text-right tabular-nums">{quantity}</td>
                    <td className="text-right tabular-nums">{formatINR(avgPrice)}</td>
                    <td className="text-right tabular-nums">{formatINR(marketPrice)}</td>
                    <td className="text-right tabular-nums">{formatINR(invested)}</td>
                    <td className="text-right tabular-nums font-medium">{formatINR(marketValue)}</td>
                    <td className={`text-right tabular-nums font-semibold ${isProfit ? 'text-positive' : 'text-negative'}`}>
                      {isProfit ? '+' : ''}{formatINR(pnl)}
                    </td>
                    <td className="text-right tabular-nums">
                      <span className={`metric-pill ${isProfit ? 'pill-positive' : 'pill-negative'}`}>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          selectAsset({
                            symbol: position.symbol,
                            name: position.symbol,
                            price: marketPrice || avgPrice
                          })
                        }
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-panel">No open positions in your portfolio yet.</div>
      )}
    </section>
  );
}

export default PositionsTable;
