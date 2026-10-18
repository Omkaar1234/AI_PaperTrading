import React from 'react';
import { formatINR } from '../constants';
import OrdersTable from './OrdersTable';
import PositionsTable from './PositionsTable';

function TerminalDock({ activeDockTab, cancelOrder, orders, positions, recentTrades = [], selectAsset, setActiveDockTab, cancellingOrderId = null }) {
  return (
    <section className="card terminal-dock">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Execution monitor</p>
          <h3>Orders, Positions, Trades</h3>
        </div>
        <div className="mini-segments">
          <button className={activeDockTab === 'orders' ? 'active' : ''} onClick={() => setActiveDockTab('orders')}>
            Orders
          </button>
          <button className={activeDockTab === 'positions' ? 'active' : ''} onClick={() => setActiveDockTab('positions')}>
            Positions
          </button>
          <button className={activeDockTab === 'history' ? 'active' : ''} onClick={() => setActiveDockTab('history')}>
            Trades
          </button>
        </div>
      </div>

      {activeDockTab === 'positions' ? (
        <PositionsTable embedded positions={positions} selectAsset={selectAsset} />
      ) : activeDockTab === 'orders' ? (
        <OrdersTable cancelOrder={cancelOrder} embedded orders={orders} cancellingOrderId={cancellingOrderId} />
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table semantic-table">
            <thead>
              <tr>
                <th className="text-left">Time</th>
                <th className="text-right">Price</th>
                <th className="text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.length ? (
                recentTrades.map((trade, index) => (
                  <tr key={trade.id || index}>
                    <td className="text-left tabular-nums text-muted text-sm">{new Date(trade.executedAt || trade.timestamp).toLocaleTimeString()}</td>
                    <td className="text-right tabular-nums font-medium">{formatINR(trade.price)}</td>
                    <td className="text-right tabular-nums">{trade.quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center text-muted" style={{ padding: '24px' }}>No trade history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TerminalDock;
