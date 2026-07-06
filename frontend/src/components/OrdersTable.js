import React from 'react';
import { formatINR } from '../constants';

function OrdersTable({ cancelOrder, orders, embedded = false }) {
  return (
    <section className={embedded ? '' : 'card'}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Orders</p>
          <h3>Placed Orders</h3>
        </div>
      </div>

      <div className="data-table">
        <div className="table-head neutral seven">
          <span>Time</span>
          <span>Symbol</span>
          <span>Side</span>
          <span>Type</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Status</span>
        </div>
        {orders.length ? (
          [...orders].reverse().map((order) => (
            <div className="table-row neutral seven" key={order.id}>
              <span>{new Date(order.timestamp).toLocaleString()}</span>
              <span>{order.symbol}</span>
              <span className={order.side === 'BUY' ? 'text-positive' : 'text-negative'}>{order.side}</span>
              <span>{order.type}</span>
              <span>{order.filled_qty}/{order.quantity}</span>
              <span>{formatINR(order.avg_fill_price || order.price || 0)}</span>
              <span className="status-chip">
                {order.status}
                {cancelOrder && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') ? (
                  <button className="secondary-button" type="button" onClick={() => cancelOrder(order)}>
                    Cancel
                  </button>
                ) : null}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-panel">No orders yet.</div>
        )}
      </div>
    </section>
  );
}

export default OrdersTable;
