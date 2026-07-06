import React from 'react';
import OrderBookCard from '../components/OrderBookCard';

function OrderBookPage({ trading }) {
  return (
    <div className="page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Endpoint</p>
          <h2>/orderbook</h2>
        </div>
        <button className="secondary-button" onClick={trading.fetchOrderBook}>
          Refresh Book
        </button>
      </div>
      <OrderBookCard orderBook={trading.orderBook} />
    </div>
  );
}

export default OrderBookPage;
