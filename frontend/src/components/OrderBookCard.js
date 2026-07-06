import React from 'react';

function OrderBookCard({ compact = false, orderBook }) {
  const bids = compact ? orderBook.bids.slice(0, 6) : orderBook.bids;
  const asks = compact ? [...orderBook.asks].reverse().slice(0, 6) : [...orderBook.asks].reverse();
  const maxDepth = Math.max(
    1,
    ...[...bids, ...asks].map((order) => Number(order.remaining ?? order.remaining_qty ?? order.quantity ?? 0))
  );

  const renderRow = (order, index, side) => {
    const quantity = Number(order.remaining ?? order.remaining_qty ?? order.quantity ?? 0);
    const depth = Math.min(100, (quantity / maxDepth) * 100);

    return (
      <div
        className={`table-row ${side}`}
        key={`${side}-${order.id || index}`}
        style={{ '--depth': `${depth}%` }}
      >
        <span>${Number(order.price).toFixed(2)}</span>
        <span>{quantity}</span>
      </div>
    );
  };

  return (
    <section className="card orderbook-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Market depth</p>
          <h3>Order Book</h3>
        </div>
      </div>

      <div className="orderbook-grid">
        <div>
          <div className="table-head sell">
            <span>Sell Price</span>
            <span>Qty</span>
          </div>
          <div className="table-stack">
            {asks.length ? (
              asks.map((order, index) => renderRow(order, index, 'ask'))
            ) : (
              <div className="empty-panel small">No sell orders</div>
            )}
          </div>
        </div>

        <div>
          <div className="table-head buy">
            <span>Buy Price</span>
            <span>Qty</span>
          </div>
          <div className="table-stack">
            {bids.length ? (
              bids.map((order, index) => renderRow(order, index, 'bid'))
            ) : (
              <div className="empty-panel small">No buy orders</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default OrderBookCard;
