import React from 'react';
import ReactDOMServer from 'react-dom/server';
import OrderBookCard from './OrderBookCard';
import TradeFormCard from './TradeFormCard';
import OrdersTable from './OrdersTable';

describe('OrderBookCard Component', () => {
  const sampleBook = {
    symbol: 'RELIANCE.NS',
    bids: [
      { id: 'b1', price: 2915.00, quantity: 50, remaining: 50 },
      { id: 'b2', price: 2910.00, quantity: 100, remaining: 100 }
    ],
    asks: [
      { id: 'a1', price: 2920.00, quantity: 40, remaining: 40 },
      { id: 'a2', price: 2925.00, quantity: 80, remaining: 80 }
    ]
  };

  test('renders order book with formatted bids, asks, spread and midpoint', () => {
    const html = ReactDOMServer.renderToString(
      <OrderBookCard orderBook={sampleBook} selectedAsset={{ symbol: 'RELIANCE.NS', name: 'Reliance Industries' }} />
    );

    expect(html).toContain('RELIANCE.NS');
    expect(html).toContain('Reliance Industries');
    expect(html).toContain('Level 2 Market Depth');
    expect(html).toContain('Matching Engine Book');
    // Check spread: 2920 - 2915 = 5.00
    expect(html).toContain('5.00');
    expect(html).toContain('spread-amount');
    // Check midpoint: (2920 + 2915) / 2 = 2917.50
    expect(html).toContain('2917.50');
    // Check bid and ask prices rendered
    expect(html).toContain('2,915.00');
    expect(html).toContain('2,920.00');
    // Scope note
    expect(html).toContain('UPRISE Matching Scope');
  });

  test('handles empty book gracefully without NaN or crashing', () => {
    const emptyBook = { symbol: 'INFY.NS', bids: [], asks: [] };
    const html = ReactDOMServer.renderToString(
      <OrderBookCard orderBook={emptyBook} selectedAsset={{ symbol: 'INFY.NS' }} />
    );

    expect(html).toContain('INFY.NS');
    expect(html).toContain('Order Book is Empty');
    expect(html).toContain('No active resting limit orders');
    expect(html).toContain('—'); // spread is null fallback
  });

  test('handles disconnected matching engine error state', () => {
    const errorBook = { symbol: 'BTC/USDT', bids: [], asks: [], error: 'Matching engine offline' };
    const html = ReactDOMServer.renderToString(
      <OrderBookCard orderBook={errorBook} isEngineConnected={false} />
    );

    expect(html).toContain('Matching Engine Offline');
    expect(html).toContain('Matching engine offline');
    expect(html).toContain('Live depth streaming paused');
  });

  test('renders loading skeleton when book is loading and empty', () => {
    const html = ReactDOMServer.renderToString(
      <OrderBookCard loading={true} orderBook={{ bids: [], asks: [] }} />
    );

    expect(html).toContain('orderbook-skeleton-grid');
    expect(html).toContain('Updating...');
  });

  test('handles single-sided book without calculating invalid spread', () => {
    const bidsOnlyBook = {
      symbol: 'TCS.NS',
      bids: [{ id: 'b1', price: 3750.00, quantity: 10, remaining: 10 }],
      asks: []
    };
    const html = ReactDOMServer.renderToString(
      <OrderBookCard orderBook={bidsOnlyBook} />
    );

    expect(html).toContain('3,750.00');
    expect(html).toContain('No active sell orders');
    // Spread and midpoint must be —
    expect(html).toContain('—');
  });
});

describe('TradeFormCard Component', () => {
  const mockUser = { balance: 100000 };
  const mockAsset = { symbol: 'RELIANCE.NS', assetType: 'stocks' };
  const mockPositions = [{ symbol: 'RELIANCE.NS', quantity: 25 }];

  test('renders order ticket with buying power and reference price', () => {
    const html = ReactDOMServer.renderToString(
      <TradeFormCard
        assetInfo={{ currentPrice: 2900 }}
        selectedAsset={mockAsset}
        orderType="LIMIT"
        tradeMode="BUY"
        tradePrice="2900.00"
        tradeQuantity={10}
        user={mockUser}
        positions={mockPositions}
        handlePlaceOrder={() => {}}
      />
    );

    expect(html).toContain('RELIANCE.NS');
    expect(html).toContain('Execution Desk');
    expect(html).toContain('Limit Order');
    // Available cash
    expect(html).toContain('₹1,00,000.00');
    // Order notional: 10 * 2900 = 29,000
    expect(html).toContain('₹29,000.00');
    // Button text
    expect(html).toContain('Buy 10 RELIANCE.NS (LIMIT)');
  });

  test('never uses 0 as market fallback and blocks market order if quote unavailable', () => {
    const html = ReactDOMServer.renderToString(
      <TradeFormCard
        assetInfo={{ currentPrice: 0 }}
        selectedAsset={mockAsset}
        orderType="MARKET"
        tradeMode="BUY"
        tradeQuantity={5}
        user={mockUser}
        positions={mockPositions}
        handlePlaceOrder={() => {}}
      />
    );

    expect(html).toContain('Price Pending');
    expect(html).toContain('Market Quote Unavailable');
    expect(html).toContain('disabled');
  });

  test('shows submitting spinner and disables button when isSubmittingOrder is true', () => {
    const html = ReactDOMServer.renderToString(
      <TradeFormCard
        assetInfo={{ currentPrice: 2900 }}
        selectedAsset={mockAsset}
        orderType="LIMIT"
        tradeMode="BUY"
        tradePrice="2900.00"
        tradeQuantity={10}
        user={mockUser}
        positions={mockPositions}
        isSubmittingOrder={true}
        handlePlaceOrder={() => {}}
      />
    );

    expect(html).toContain('Placing Order to Engine...');
    expect(html).toContain('btn-spinner');
    expect(html).toContain('disabled');
  });

  test('displays warning alert when order value exceeds available cash balance', () => {
    const smallBalanceUser = { balance: 5000 };
    const html = ReactDOMServer.renderToString(
      <TradeFormCard
        assetInfo={{ currentPrice: 2900 }}
        selectedAsset={mockAsset}
        orderType="LIMIT"
        tradeMode="BUY"
        tradePrice="2900.00"
        tradeQuantity={10} // notional = 29,000 > 5,000
        user={smallBalanceUser}
        positions={mockPositions}
        handlePlaceOrder={() => {}}
      />
    );

    expect(html).toContain('ticket-warning-alert');
    expect(html).toContain('exceeds available capital');
    expect(html).toContain('Insufficient Cash');
  });

  test('displays warning alert when sell quantity exceeds open position', () => {
    const html = ReactDOMServer.renderToString(
      <TradeFormCard
        assetInfo={{ currentPrice: 2900 }}
        selectedAsset={mockAsset}
        orderType="LIMIT"
        tradeMode="SELL"
        tradePrice="2900.00"
        tradeQuantity={50} // 50 > 25 available
        user={mockUser}
        positions={mockPositions}
        handlePlaceOrder={() => {}}
      />
    );

    expect(html).toContain('ticket-warning-alert');
    expect(html).toContain('exceeds your current holding of');
    expect(html).toContain('Exceeds Holding');
  });
});

describe('OrdersTable Component', () => {
  const sampleOrders = [
    {
      id: 'ord_101',
      symbol: 'RELIANCE.NS',
      side: 'BUY',
      type: 'LIMIT',
      price: 2850.00,
      avg_fill_price: 2850.00,
      quantity: 20,
      filled_qty: 20,
      remaining_qty: 0,
      status: 'FILLED',
      timestamp: '2026-10-18T10:00:00Z'
    },
    {
      id: 'ord_102',
      symbol: 'TCS.NS',
      side: 'BUY',
      type: 'LIMIT',
      price: 3780.00,
      avg_fill_price: 3779.50,
      quantity: 40,
      filled_qty: 15,
      remaining_qty: 25,
      status: 'PARTIALLY_FILLED',
      timestamp: '2026-10-18T11:00:00Z'
    },
    {
      id: 'ord_103',
      symbol: 'HDFCBANK.NS',
      side: 'BUY',
      type: 'LIMIT',
      price: 1850.00,
      quantity: 10,
      filled_qty: 0,
      remaining_qty: 10,
      status: 'OPEN',
      timestamp: '2026-10-18T12:00:00Z'
    },
    {
      id: 'ord_104',
      symbol: 'INFY.NS',
      side: 'BUY',
      type: 'MARKET',
      price: 1940.00,
      quantity: 25,
      filled_qty: 0,
      remaining_qty: 0,
      status: 'CANCELLED',
      timestamp: '2026-10-18T12:30:00Z'
    },
    {
      id: 'ord_105',
      symbol: 'BTC/USDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 65000.00,
      quantity: 5,
      filled_qty: 0,
      remaining_qty: 5,
      status: 'REJECTED',
      timestamp: '2026-10-18T09:00:00Z'
    }
  ];

  test('renders all lifecycle order statuses and progress tracks', () => {
    const html = ReactDOMServer.renderToString(
      <OrdersTable orders={sampleOrders} cancelOrder={() => {}} />
    );

    // Status chips
    expect(html).toContain('FILLED');
    expect(html).toContain('PARTIAL');
    expect(html).toContain('OPEN');
    expect(html).toContain('CANCELLED');
    expect(html).toContain('REJECTED');

    // Partial fill progress
    expect(html).toContain('38%');
    expect(html).toContain('fill-progress-bar partial');

    // Full fill progress
    expect(html).toContain('100%');
    expect(html).toContain('fill-progress-bar full');

    // Unfilled market order explanation
    expect(html).toContain('Unfilled Market Order · Zero counterparty liquidity');

    // Resting in engine book note
    expect(html).toContain('Resting in matching engine book');
  });

  test('calculates correct summary metrics strip', () => {
    const html = ReactDOMServer.renderToString(
      <OrdersTable orders={sampleOrders} />
    );

    expect(html).toContain('Active Orders');
    // Active orders: 2 (ord_102 PARTIALLY_FILLED, ord_103 OPEN)
    expect(html).toContain('>2</strong>');
    // Fully filled: 1 (ord_101)
    expect(html).toContain('Fully Filled');
    expect(html).toContain('>1</strong>');
    // Cancelled / Rejected: 2 (ord_104, ord_105)
    expect(html).toContain('Cancelled / Rejected');
  });

  test('shows Cancel button only for cancelable active orders', () => {
    const html = ReactDOMServer.renderToString(
      <OrdersTable orders={sampleOrders} cancelOrder={() => {}} />
    );

    // Cancel buttons present for OPEN and PARTIALLY_FILLED
    expect(html).toContain('Cancel resting order ord_102');
    expect(html).toContain('Cancel resting order ord_103');
    // Non-active orders get em-dash '—'
    expect(html).toContain('—');
  });

  test('renders Cancelling... in-flight state when cancellingOrderId matches', () => {
    const html = ReactDOMServer.renderToString(
      <OrdersTable orders={sampleOrders} cancelOrder={() => {}} cancellingOrderId="ord_103" />
    );

    expect(html).toContain('Cancelling...');
  });
});
