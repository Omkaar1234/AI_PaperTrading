# AI-Assisted Trading Simulation Platform

A multi-service paper trading platform supporting Indian equities (NSE/BSE) and Crypto assets with a React dashboard, Node.js API orchestrator, MongoDB persistence, Python ML analytics, and a custom C++ order matching engine.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 React Frontend (Port 3000)                  │
│       Dashboard · Markets · Trade Panel · Orders/Positions   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (/ws/market)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js API (Port 3001)                     │
│  JWT Session Auth · Market Data Aggregator · Order Routing   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               │ HTTP (:5000)                 │ TCP Socket (:9000)
               ▼                              ▼
┌─────────────────────────────┐┌──────────────────────────────┐
│  Python ML Service (:5000)  ││ C++ Matching Engine (:9000)  │
│  LSTM / Technical Indicators││ Price-Time Priority FIFO Book│
└─────────────────────────────┘└──────────────────────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │    MongoDB Atlas Database    │
               │ Users · Orders · Positions   │
               │ Watchlists · Symbols Cache   │
               └──────────────────────────────┘
```

---

## Core Components

1. **Frontend (React 18 + React Router v6)**
   - Single-page application with dark terminal aesthetic.
   - Live trading terminal with TradingView-style candlestick charting (Recharts).
   - Real-time order book visualizer, active positions tracker, portfolio P&L metrics, and watchlist.
   - Complete authentication views (Login, Registration with Initial Capital Selector ₹1L–₹10L, and Google OAuth Profile Setup).

2. **Backend Orchestrator (Node.js + Express + WebSocket)**
   - Central gateway for order routing, session management, and market data normalization.
   - Persistent session authentication using HTTP-only JWT cookies (`ptx_session`) and Bcrypt password hashing.
   - Real-time market data streaming over WebSocket (`/ws/market`) with 1-second interval broadcast.
   - Symbol directory synchronization supporting over 2,600+ NSE/BSE stocks and Binance crypto pairs.
   - Multi-user data isolation enforcing ownership checks on orders, positions, trades, and watchlists.

3. **C++ Order Matching Engine (C++17 + POSIX/Winsock TCP Server)**
   - High-throughput in-memory limit order book with price-time priority (FIFO).
   - Real-time trade execution and balance settlement event generation.
   - Bid/Ask depth aggregation and order cancellation support.
   - Direct trade logging to disk (`trades.log`).

4. **ML Service (Python 3.11 + Flask + scikit-learn + yfinance)**
   - Historical time-series data extraction and technical indicator computation (SMA, RSI, MACD, Bollinger Bands).
   - Machine learning price trend classification (LSTM and linear models).
   - Rule-based investment suggestions (`STRONG_BUY`, `BUY`, `HOLD`, `SELL`, `STRONG_SELL`).
   - Built-in deterministic mock prediction fallback when upstream market data is unreachable.

---

## Prerequisites

- **Node.js**: v18.0+ or v20.0+ (npm 9+)
- **Python**: v3.9+ or v3.11+
- **C++ Compiler**: GCC/MinGW (g++ 9+) or MSVC with C++17 support
- **CMake**: v3.14+
- **MongoDB**: Active MongoDB Atlas cluster or local MongoDB instance

---

## Setup & Startup Instructions

### 1. Environment Configuration

Create or verify the `.env` file in the project root:

```env
# JWT Secret Key
JWT_SECRET=your_secure_jwt_secret_here

# Backend API
BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0

# Service Connections (Use localhost for bare-metal, or service names for Docker)
MATCHING_ENGINE_HOST=localhost
MATCHING_ENGINE_PORT=9000
ML_HOST=localhost
ML_PORT=5000

# Frontend
FRONTEND_PORT=3000
CORS_ORIGIN=http://localhost:3000

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=Cluster0
MONGODB_DB=PaperTrading

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

> **Important Note for Local / Bare-Metal Execution**: Ensure `MATCHING_ENGINE_HOST=localhost` and `ML_HOST=localhost` in `.env` when running outside Docker.

---

### 2. Service Startup

#### Automated Startup (Windows)
```cmd
start.bat
```

#### Automated Startup (Linux / macOS)
```bash
chmod +x start.sh
./start.sh
```

#### Manual Step-by-Step Startup

1. **Install Dependencies:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

2. **Set up Python Virtual Environment:**
   ```bash
   cd ml-service
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   pip install -r requirements.txt
   cd ..
   ```

3. **Build C++ Matching Engine:**
   ```bash
   cd matching-engine
   mkdir build && cd build
   cmake .. -DCMAKE_BUILD_TYPE=Release
   cmake --build . --config Release
   cd ../..
   ```

4. **Launch All Services (In separate terminals):**

   * **Terminal 1 (Matching Engine):**
     ```bash
     # Windows:
     .\matching-engine\build\matching_engine.exe 9000
     # Linux/macOS:
     ./matching-engine/build/matching_engine 9000
     ```

   * **Terminal 2 (Python ML Service):**
     ```bash
     cd ml-service
     .\venv\Scripts\python.exe app.py
     ```

   * **Terminal 3 (Node.js Backend):**
     ```bash
     cd backend
     node server.js
     ```

   * **Terminal 4 (React Frontend):**
     ```bash
     cd frontend
     npm start
     ```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user with initial paper balance |
| `POST` | `/api/auth/login` | Public | Authenticate with email and password |
| `POST` | `/api/auth/logout` | Public | Invalidate session and clear auth cookies |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `GET` | `/api/auth/google/start` | Public | Initiate Google OAuth redirect flow |
| `GET` | `/api/auth/google/callback` | Public | OAuth callback handler |
| `POST` | `/api/auth/google/setup` | Public (Token) | Complete Google OAuth profile registration |

### Market Data Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/symbols` | Public | Paginated symbol master directory |
| `GET` | `/api/search` | Public | Search symbols by ticker or company name |
| `GET` | `/api/market` | Public | Market overview page with quotes |
| `GET` | `/api/market/quote/:symbol` | Public | Real-time quote snapshot for symbol |
| `GET` | `/api/market/quotes` | Public | Batch quote lookup for multiple symbols |
| `GET` | `/api/market/candles/:symbol` | Public | OHLCV candlestick historical data |
| `GET` | `/api/market/watchlist/:userId` | Authenticated | Fetch user's saved watchlist |
| `PUT` | `/api/market/watchlist/:userId` | Authenticated | Update user's saved watchlist |

### Trading & Portfolio Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/orders` | Authenticated | Submit BUY / SELL Limit or Market order |
| `POST` | `/api/orders/:orderId/cancel`| Authenticated | Cancel an open resting order |
| `GET` | `/api/orders/:orderId` | Authenticated | Get order details by ID |
| `GET` | `/api/orderbook/:symbol` | Public | Retrieve live order book depth |
| `GET` | `/api/users/:userId/orders` | Authenticated | List all submitted orders for user |
| `GET` | `/api/users/:userId/trades` | Authenticated | List all executed trades for user |
| `GET` | `/api/positions/:userId` | Authenticated | Get current open positions |
| `GET` | `/api/portfolio/:userId` | Authenticated | Get full portfolio value, cash, and P&L |
| `GET` | `/trades` | Public | Global recent trades feed |

### AI & Analytics Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/predict` | Authenticated | Get price trend prediction (with mock fallback) |
| `POST` | `/suggest` | Authenticated | Get BUY/SELL/HOLD suggestion based on trend |
| `POST` | `/api/predict` | Authenticated | Forward prediction request to ML service |
| `POST` | `/api/suggest` | Authenticated | Forward suggestion request to ML service |

---

## License

MIT License - For simulation and educational purposes only.
