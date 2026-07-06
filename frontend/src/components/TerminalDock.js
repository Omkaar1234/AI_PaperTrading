import React from 'react';
import { formatINR } from '../constants';
import OrdersTable from './OrdersTable';
import PositionsTable from './PositionsTable';

function TerminalDock({ activeDockTab, cancelOrder, orders, positions, recentTrades = [], selectAsset, setActiveDockTab }) {
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
        <OrdersTable cancelOrder={cancelOrder} embedded orders={orders} />
      ) : (
        <div className="data-table">
          <div className="table-head neutral three">
            <span>Time</span>
            <span>Price</span>
            <span>Qty</span>
          </div>
          {recentTrades.length ? (
            recentTrades.map((trade, index) => (
              <div className="table-row neutral three" key={trade.id || index}>
                <span>{new Date(trade.executedAt || trade.timestamp).toLocaleTimeString()}</span>
                <span>{formatINR(trade.price)}</span>
                <span>{trade.quantity}</span>
              </div>
            ))
          ) : (
            <div className="empty-panel">No trade history yet.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default TerminalDock;
