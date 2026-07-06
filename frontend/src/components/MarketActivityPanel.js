import React from 'react';
import OrderBookCard from './OrderBookCard';
import TradesCard from './TradesCard';

function MarketActivityPanel({ orderBook, recentTrades }) {
  return (
    <div className="market-activity-stack">
      <OrderBookCard compact orderBook={orderBook} />
      <TradesCard recentTrades={recentTrades} />
    </div>
  );
}

export default MarketActivityPanel;
