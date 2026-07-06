import React from 'react';
import { formatINR } from '../constants';

function TradesCard({ recentTrades }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Executions</p>
          <h3>Recent Trades</h3>
        </div>
      </div>

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
          <div className="empty-panel">No trades executed yet.</div>
        )}
      </div>
    </section>
  );
}

export default TradesCard;
