import React from 'react';
import OrdersTable from '../components/OrdersTable';

function OrdersPage({ trading }) {
  return (
    <div className="page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Order history</p>
        </div>
        <button className="secondary-button" onClick={trading.fetchPortfolio}>
          Refresh Orders
        </button>
      </div>

      <OrdersTable cancelOrder={trading.cancelOrder} orders={trading.orders} />
    </div>
  );
}

export default OrdersPage;
