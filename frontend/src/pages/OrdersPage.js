import React from 'react';
import OrdersTable from '../components/OrdersTable';

function OrdersPage({ trading }) {
  return (
    <div className="page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Execution History</p>
          <h2>Orders</h2>
          <p className="page-subtext">Review submitted orders, execution statuses, and cancellations.</p>
        </div>
        <button className="secondary-button" onClick={trading.fetchPortfolio}>
          Refresh Orders
        </button>
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
