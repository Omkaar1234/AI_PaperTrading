import React from 'react';
import OrdersTable from '../components/OrdersTable';
import TradesCard from '../components/TradesCard';

function TradesPage({ trading }) {
  return (
    <div className="page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Execution feed</p>
          <h2>/trades</h2>
        </div>
        <button className="secondary-button" onClick={trading.fetchRecentTrades}>
          Refresh Trades
        </button>
      </div>
      <TradesCard recentTrades={trading.recentTrades} />
      <OrdersTable cancelOrder={trading.cancelOrder} orders={trading.orders} />
    </div>
  );
}

export default TradesPage;
