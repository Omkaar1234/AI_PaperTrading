import React, { useEffect } from 'react';
import OrderBookCard from '../components/OrderBookCard';

const POPULAR_INSTRUMENTS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'BTC/USDT', name: 'Bitcoin / Tether' }
];

function OrderBookPage({ trading }) {
  const selectedSymbol = trading?.selectedAsset?.symbol || 'RELIANCE.NS';
  const fetchOrderBook = trading?.fetchOrderBook;

  useEffect(() => {
    if (fetchOrderBook && selectedSymbol) {
      fetchOrderBook(selectedSymbol);
    }
  }, [fetchOrderBook, selectedSymbol]);

  const handleSelectSymbol = async (inst) => {
    if (trading?.selectAsset) {
      await trading.selectAsset(inst);
    }
    if (fetchOrderBook) {
      fetchOrderBook(inst.symbol);
    }
  };

  return (
    <div className="page orderbook-page">
      {/* PAGE HEADER */}
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Microstructure & Liquidity</p>
          <h2>Order Book Depth</h2>
          <p className="page-subtext">
            Real-time Level 2 bid and ask queue in the UPRISE price-time matching engine.
          </p>
        </div>
        <div className="orderbook-page-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => fetchOrderBook && fetchOrderBook(selectedSymbol)}
            disabled={trading?.orderBookLoading}
          >
            {trading?.orderBookLoading ? 'Refreshing...' : 'Refresh Book'}
          </button>
        </div>
      </div>

      {/* QUICK INSTRUMENT SELECTOR PILLS */}
      <div className="orderbook-symbol-strip" role="group" aria-label="Select instrument for depth">
        <span className="strip-label text-muted">Instruments:</span>
        <div className="symbol-pills-row">
          {POPULAR_INSTRUMENTS.map((inst) => {
            const isSelected = selectedSymbol === inst.symbol;
            return (
              <button
                key={inst.symbol}
                type="button"
                className={`symbol-depth-pill ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectSymbol(inst)}
                aria-pressed={isSelected}
              >
                <strong>{inst.symbol}</strong>
                <span className="pill-subtext">{inst.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN ORDER BOOK CARD */}
      <OrderBookCard
        orderBook={trading?.orderBook}
        selectedAsset={trading?.selectedAsset || { symbol: selectedSymbol }}
        loading={trading?.orderBookLoading}
        error={trading?.orderBookError}
        lastUpdated={trading?.orderBookLastUpdated}
        onRefresh={() => fetchOrderBook && fetchOrderBook(selectedSymbol)}
      />

      {/* MICROSTRUCTURE EDUCATION & LIQUIDITY GUIDE */}
      <section className="card microstructure-guide-card" aria-label="Microstructure education guide">
        <div className="guide-header">
          <span className="guide-icon" aria-hidden="true">💡</span>
          <div>
            <h4 className="guide-title">Market Microstructure & Order Matching Principles</h4>
            <p className="guide-subtitle text-muted">
              Institutional fundamentals of price-time priority, spread mechanics, and fill behavior.
            </p>
          </div>
        </div>

        <div className="guide-grid">
          <div className="guide-col">
            <h5 className="guide-col-title text-positive">1. Price-Time Priority Matching</h5>
            <p className="guide-col-text">
              Resting orders are ranked first by <strong>Price</strong> (highest Bid, lowest Ask) and second by <strong>Time of arrival</strong>. An earlier order at ₹100.00 will match completely before a later order at ₹100.00 receives any fill.
            </p>
          </div>

          <div className="guide-col">
            <h5 className="guide-col-title text-primary">2. Bid-Ask Spread & Midpoint</h5>
            <p className="guide-col-text">
              The <strong>Spread</strong> represents the liquidity cost paid when crossing the book with a market order. The <strong>Midpoint</strong> is the unweighted average between Best Bid and Best Ask, serving as the fair reference price before queue imbalance.
            </p>
          </div>

          <div className="guide-col">
            <h5 className="guide-col-title text-warning">3. Empty Book & Partial Fills</h5>
            <p className="guide-col-text">
              Unlike simulated brokers that invent synthetic liquidity, UPRISE only matches against real resting orders in the engine. If opposite liquidity is insufficient, remaining market orders cancel to prevent ruinous slippage. Limit orders rest safely until matched.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OrderBookPage;
