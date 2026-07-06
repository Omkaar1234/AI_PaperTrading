# AI Trading Platform Upgrade Blueprint

## 1. Current Baseline

- Frontend routes already exist in `frontend/src/App.js`:
  - `/dashboard`
  - `/predict`
  - `/trade`
  - `/orderbook`
  - `/trades`
- Frontend state is centralized in `frontend/src/hooks/useTradingData.js`.
- Backend currently mixes:
  - simple demo order APIs (`/order`, `/orderbook`, `/trades`)
  - richer APIs under `/api/*`
  - in-memory user/order/trade state in `backend/server.js`
- ML historical data already uses Yahoo Finance in `ml-service/app.py`.
- Matching engine integration exists through TCP in `backend/server.js`.

## 2. Architecture Decision

There is a requirement conflict:

- Task 1 says `MongoDB preferred`
- Task 5 says `Database (PostgreSQL)`

### Recommended practical path

Use **MongoDB** for the first production-grade upgrade because:

- your current backend is already JSON/document-oriented
- watchlists, positions snapshots, market cache, and user preferences map naturally to documents
- the change is lower-risk than a full relational migration from the current in-memory model

### If PostgreSQL is mandatory later

Keep the service contracts identical and move only the repository layer. The APIs and frontend do not need to change if repositories are isolated behind service classes.

## 3. Target Service Layout

```text
backend/
  src/
    config/
      env.js
      db.js
    modules/
      users/
        user.model.js
        user.repository.js
        user.service.js
        user.controller.js
      orders/
        order.model.js
        order.repository.js
        order.service.js
        order.controller.js
      trades/
        trade.model.js
        trade.repository.js
        trade.service.js
        trade.controller.js
      positions/
        position.model.js
        position.service.js
      watchlist/
        watchlist.model.js
        watchlist.service.js
      market-data/
        marketData.model.js
        marketData.service.js
        providerFactory.js
        providers/
          yahooProvider.js
          binanceProvider.js
          alphaVantageProvider.js
    integrations/
      matchingEngineClient.js
      mlClient.js
    websockets/
      marketStream.js
    routes/
      index.js
    app.js
  server.js
```

## 4. Phased Implementation Plan

### Phase 1: Persistence foundation

1. Add Mongo connection bootstrap and fail-fast startup.
2. Move `users`, `userOrders`, and `trades` out of `backend/server.js`.
3. Introduce repository + service separation.
4. Persist:
   - users
   - orders
   - trades
   - positions
   - watchlists
   - market data cache
5. Keep current endpoints working by preserving response shape.

### Phase 2: Matching engine persistence

1. Wrap all matching-engine calls in a dedicated integration client.
2. After order placement:
   - persist the order first as `PENDING_SUBMISSION`
   - send to matching engine
   - update to `OPEN`, `PARTIALLY_FILLED`, or `FILLED`
3. Persist each execution as a trade record.
4. Rebuild positions from executed trades or update positions atomically in a portfolio service.

### Phase 3: Real-time market data

1. Add provider abstraction with normalized output.
2. Use:
   - Yahoo Finance for stocks and forex snapshots/history
   - Binance for crypto live tickers
3. Cache quote snapshots in Mongo with TTL.
4. Expose:
   - REST for initial fetch
   - WebSocket for live updates
5. Update frontend hook to use live quotes instead of local mock refresh logic.

### Phase 4: UI upgrade without breaking pages

1. Preserve all existing routes.
2. Introduce a new shared terminal layout shell.
3. Replace page internals incrementally:
   - `DashboardPage` becomes the main trading terminal
   - `TradePage` gets a pro order entry panel
   - `OrderBookPage` and `TradesPage` reuse new right/bottom panels
4. Keep existing component contracts where possible and swap internals gradually.

### Phase 5: Reliability and restart safety

1. Add startup recovery:
   - rebuild open orders state from DB
   - reload cached quotes
   - restore user portfolio snapshots
2. Add idempotent trade ingest from matching engine.
3. Add audit fields and indexes.
4. Add background jobs for stale market cache cleanup.

## 5. MongoDB Schema

### users

```js
{
  _id: ObjectId,
  userId: "user_001",
  name: "Default User",
  email: "demo@papertrading.local",
  status: "ACTIVE",
  wallet: {
    cashBalance: 100000,
    currency: "USD",
    buyingPower: 100000
  },
  preferences: {
    theme: "dark",
    defaultAssetType: "stocks"
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

Indexes:

- `userId` unique
- `email` unique sparse

### orders

```js
{
  _id: ObjectId,
  orderId: "ord_123",
  userId: "user_001",
  symbol: "AAPL",
  assetType: "stocks",
  exchange: "NASDAQ",
  side: "BUY",
  orderType: "LIMIT",
  timeInForce: "GTC",
  requestedQty: 10,
  filledQty: 4,
  remainingQty: 6,
  limitPrice: 178.25,
  avgFillPrice: 178.1,
  status: "PARTIALLY_FILLED",
  source: "frontend",
  engineOrderRef: "me_456",
  submittedAt: ISODate,
  lastEventAt: ISODate,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

Indexes:

- `orderId` unique
- compound: `userId + createdAt`
- compound: `symbol + status + createdAt`

### trades

```js
{
  _id: ObjectId,
  tradeId: "trd_123",
  orderId: "ord_123",
  engineTradeRef: "eng_trd_98",
  userId: "user_001",
  symbol: "AAPL",
  assetType: "stocks",
  side: "BUY",
  quantity: 4,
  price: 178.1,
  notional: 712.4,
  fees: 0,
  counterpartyOrderId: "ord_999",
  executedAt: ISODate,
  createdAt: ISODate
}
```

Indexes:

- `tradeId` unique
- `engineTradeRef` unique sparse
- compound: `userId + executedAt`

### positions

```js
{
  _id: ObjectId,
  userId: "user_001",
  symbol: "AAPL",
  assetType: "stocks",
  quantity: 14,
  averagePrice: 176.42,
  marketPrice: 178.5,
  marketValue: 2499,
  unrealizedPnl: 29.12,
  realizedPnl: 120.44,
  lastUpdatedAt: ISODate,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

Indexes:

- compound unique: `userId + symbol`

### watchlists

```js
{
  _id: ObjectId,
  userId: "user_001",
  name: "Primary",
  symbols: [
    { symbol: "AAPL", assetType: "stocks" },
    { symbol: "BTC-USD", assetType: "crypto" },
    { symbol: "EURUSD=X", assetType: "forex" }
  ],
  isDefault: true,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

Indexes:

- compound: `userId + isDefault`

### market_data_cache

```js
{
  _id: ObjectId,
  symbol: "AAPL",
  assetType: "stocks",
  provider: "yahoo",
  interval: "1m",
  quote: {
    price: 178.5,
    change: 1.82,
    changePercent: 1.03,
    volume: 52345678,
    open: 176.1,
    high: 179.2,
    low: 175.9,
    previousClose: 176.68
  },
  candles: [
    {
      time: ISODate,
      open: 177.1,
      high: 178.9,
      low: 176.8,
      close: 178.5,
      volume: 900345
    }
  ],
  fetchedAt: ISODate,
  expiresAt: ISODate
}
```

Indexes:

- compound unique: `symbol + interval + provider`
- TTL index on `expiresAt`

## 6. Logical Relations

- `users.userId` -> `orders.userId`
- `users.userId` -> `trades.userId`
- `users.userId` -> `positions.userId`
- `users.userId` -> `watchlists.userId`
- `orders.orderId` -> `trades.orderId`

## 7. Backend API Changes

### Keep existing endpoints

Do not remove:

- `POST /predict`
- `POST /suggest`
- `POST /order`
- `GET /orderbook`
- `GET /trades`
- `POST /api/orders`
- `GET /api/users/:userId`
- `GET /api/users/:userId/orders`

### Add or formalize these endpoints

- `GET /api/market/quote/:symbol?assetType=stocks`
- `GET /api/market/candles/:symbol?assetType=stocks&interval=1m&range=1d`
- `GET /api/market/watchlist/:userId`
- `PUT /api/market/watchlist/:userId`
- `GET /api/portfolio/:userId`
- `GET /api/positions/:userId`
- `POST /api/trades/ingest`
- `GET /api/orders/:userId/history`
- `GET /api/orders/:orderId`
- `WS /ws/market`
- `WS /ws/orderbook`

### Response contract for normalized market quote

```json
{
  "symbol": "AAPL",
  "assetType": "stocks",
  "price": 178.5,
  "change": 1.82,
  "volume": 52345678,
  "timestamp": "2026-04-26T12:30:00.000Z"
}
```

## 8. Provider Strategy

### Stocks

- Default: Yahoo Finance for delayed quote + historical candles
- Upgrade path: Polygon / Twelve Data / Finnhub if you need lower latency

### Crypto

- Default: Binance REST + WebSocket

### Forex

- Default: Yahoo Finance initially
- Upgrade path: Alpha Vantage or Twelve Data if symbol coverage becomes an issue

## 9. Frontend Upgrade Structure

Preserve routes, replace internals progressively.

### New shared layout

```text
AppShell
  Sidebar
  TradingTerminalLayout
    Left: WatchlistPanel
    Center: ChartWorkspace
    Right: DepthAndTradesPanel
    Bottom: OrdersPositionsTabs
```

### Component mapping from current code

- `AssetPanel` -> evolve into `WatchlistPanel`
- `ChartCard` -> evolve into `AdvancedChartCard`
- `OrderBookCard` -> evolve into `DepthPanel`
- `TradeFormCard` -> evolve into `FloatingOrderTicket`
- `OrdersTable` + `PositionsTable` -> move into bottom dock tabs

### UX direction

- retain dark theme
- tighter spacing, denser data surfaces
- mono or semi-mono numeric typography for price ladders
- sticky order ticket on desktop
- responsive collapse:
  - mobile: chart first, ticket second, tabs third
  - desktop: 3-column terminal

## 10. Code Snippets

### Mongo connection

```js
// backend/src/config/db.js
const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || 'paper_trading'
  });

  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
```

### Order model

```js
// backend/src/modules/orders/order.model.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    assetType: { type: String, enum: ['stocks', 'crypto', 'forex'], required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    orderType: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
    requestedQty: { type: Number, required: true },
    filledQty: { type: Number, default: 0 },
    remainingQty: { type: Number, required: true },
    limitPrice: Number,
    avgFillPrice: Number,
    status: {
      type: String,
      enum: ['PENDING_SUBMISSION', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED'],
      default: 'PENDING_SUBMISSION',
      index: true
    },
    engineOrderRef: String,
    submittedAt: Date,
    lastEventAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
```

### Market data service with normalization

```js
// backend/src/modules/market-data/marketData.service.js
const axios = require('axios');
const MarketDataCache = require('./marketData.model');

function normalizeQuote({ symbol, assetType, price, change, volume, timestamp }) {
  return {
    symbol,
    assetType,
    price: Number(price || 0),
    change: Number(change || 0),
    volume: Number(volume || 0),
    timestamp: timestamp || new Date().toISOString()
  };
}

async function getYahooQuote(symbol, assetType) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const { data } = await axios.get(url, { timeout: 8000 });

  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const lastPrice = closes.filter(Boolean).at(-1) || meta.regularMarketPrice || meta.previousClose;

  return normalizeQuote({
    symbol,
    assetType,
    price: lastPrice,
    change: (lastPrice || 0) - (meta.previousClose || 0),
    volume: quote.volume?.filter(Boolean).at(-1) || meta.regularMarketVolume || 0,
    timestamp: new Date().toISOString()
  });
}

async function getCachedQuote(symbol, assetType) {
  const cached = await MarketDataCache.findOne({
    symbol,
    assetType,
    expiresAt: { $gt: new Date() }
  }).lean();

  if (cached?.quote) {
    return cached.quote;
  }

  const quote = await getYahooQuote(symbol, assetType);

  await MarketDataCache.findOneAndUpdate(
    { symbol, assetType, provider: 'yahoo', interval: '1m' },
    {
      symbol,
      assetType,
      provider: 'yahoo',
      interval: '1m',
      quote,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 1000)
    },
    { upsert: true, new: true }
  );

  return quote;
}

module.exports = {
  getCachedQuote
};
```

### WebSocket market broadcaster

```js
// backend/src/websockets/marketStream.js
const WebSocket = require('ws');

function createMarketStream(server, marketDataService) {
  const wss = new WebSocket.Server({ server, path: '/ws/market' });

  wss.on('connection', (socket) => {
    socket.on('message', async (raw) => {
      const { symbols = [], assetType = 'stocks' } = JSON.parse(raw.toString());

      const sendQuotes = async () => {
        const quotes = await Promise.all(
          symbols.map((symbol) => marketDataService.getCachedQuote(symbol, assetType))
        );

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'quotes', data: quotes }));
        }
      };

      sendQuotes();
      const interval = setInterval(sendQuotes, 3000);

      socket.on('close', () => clearInterval(interval));
    });
  });

  return wss;
}

module.exports = { createMarketStream };
```

### Safe order placement flow

```js
// backend/src/modules/orders/order.service.js
const Order = require('./order.model');
const { v4: uuidv4 } = require('uuid');

async function placeOrder({ orderInput, matchingEngineClient, portfolioService }) {
  const orderId = `ord_${uuidv4().split('-')[0]}`;

  const order = await Order.create({
    orderId,
    userId: orderInput.userId,
    symbol: orderInput.symbol,
    assetType: orderInput.assetType,
    side: orderInput.side,
    orderType: orderInput.orderType,
    requestedQty: orderInput.quantity,
    remainingQty: orderInput.quantity,
    limitPrice: orderInput.price,
    status: 'PENDING_SUBMISSION'
  });

  const engineResponse = await matchingEngineClient.placeOrder(orderInput);

  order.engineOrderRef = engineResponse.orderId;
  order.filledQty = engineResponse.filledQty;
  order.remainingQty = engineResponse.remainingQty;
  order.avgFillPrice = engineResponse.avgFillPrice;
  order.status = engineResponse.status;
  order.submittedAt = new Date();
  order.lastEventAt = new Date();
  await order.save();

  await portfolioService.applyExecutions({
    userId: order.userId,
    symbol: order.symbol,
    side: order.side,
    filledQty: order.filledQty,
    avgFillPrice: order.avgFillPrice
  });

  return order;
}

module.exports = { placeOrder };
```

### Updated frontend terminal layout

```jsx
// frontend/src/pages/DashboardPage.js
import WatchlistPanel from '../components/WatchlistPanel';
import AdvancedChartCard from '../components/AdvancedChartCard';
import DepthPanel from '../components/DepthPanel';
import OrdersPositionsDock from '../components/OrdersPositionsDock';
import FloatingOrderTicket from '../components/FloatingOrderTicket';
import OverviewCards from '../components/OverviewCards';

function DashboardPage({ trading }) {
  return (
    <div className="page terminal-page">
      <OverviewCards
        orders={trading.orders}
        positions={trading.positions}
        totalPortfolioValue={trading.getTotalPortfolioValue()}
        user={trading.user}
      />

      <div className="terminal-grid">
        <WatchlistPanel trading={trading} />

        <section className="terminal-center">
          <AdvancedChartCard trading={trading} />
          <OrdersPositionsDock orders={trading.orders} positions={trading.positions} />
        </section>

        <aside className="terminal-right">
          <FloatingOrderTicket trading={trading} />
          <DepthPanel orderBook={trading.orderBook} recentTrades={trading.recentTrades} />
        </aside>
      </div>
    </div>
  );
}

export default DashboardPage;
```

### Layout CSS structure

```css
/* frontend/src/App.css */
:root {
  --bg: #07111f;
  --panel: rgba(10, 18, 30, 0.92);
  --panel-border: rgba(132, 151, 178, 0.14);
  --text: #e8eef8;
  --muted: #93a4bd;
  --green: #14c784;
  --red: #ff5c6c;
  --amber: #ffb84d;
}

.terminal-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 360px;
  gap: 16px;
  min-height: calc(100vh - 220px);
}

.terminal-center,
.terminal-right {
  display: grid;
  gap: 16px;
}

.terminal-center {
  grid-template-rows: minmax(420px, 1fr) 320px;
}

.terminal-right {
  grid-template-rows: auto minmax(0, 1fr);
}

@media (max-width: 1200px) {
  .terminal-grid {
    grid-template-columns: 1fr;
  }
}
```

## 11. Minimal Backend Migration Checklist

1. Install:
   - `mongoose`
   - `socket.io` or continue with `ws`
2. Add `.env`:
   - `MONGODB_URI=...`
   - `MARKET_DATA_PROVIDER=yahoo`
   - `BINANCE_WS_URL=wss://stream.binance.com:9443/ws`
3. Move existing route handlers from `backend/server.js` into controllers.
4. Replace in-memory maps with repositories.
5. Add tests around:
   - order placement
   - partial fill persistence
   - position updates
   - quote normalization

## 12. Do-Not-Break Rules For This Codebase

- Keep `frontend/src/App.js` route list intact.
- Keep `useTradingData` as the compatibility facade while refactoring internals.
- Keep legacy endpoints until the frontend is fully switched.
- Do not remove simple `/order`, `/orderbook`, `/trades` until all dependent components are migrated.
