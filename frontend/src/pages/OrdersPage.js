import React, { useState } from 'react';
import OrdersTable from '../components/OrdersTable';

function OrdersPage({ trading }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (typeof trading.fetchPortfolio === 'function') {
        await trading.fetchPortfolio();
      }
      if (typeof trading.fetchPositions === 'function') {
        await trading.fetchPositions();
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <div className="page orders-page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Execution History</p>
          <h2>Orders Terminal</h2>
          <p className="page-subtext">
            Audit resting limit orders, matching execution progress, fill prices, and order lifecycle states.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="secondary-button refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh orders history"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh Orders'}
          </button>
        </div>
      </div>

      <OrdersTable
        cancelOrder={trading.cancelOrder}
        orders={trading.orders}
        cancellingOrderId={trading.cancellingOrderId}
      />
    </div>
  );
}

export default OrdersPage;
