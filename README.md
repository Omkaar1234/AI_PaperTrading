# AI-Assisted Trading Simulation Platform

A comprehensive trading simulation system with AI-powered predictions, a custom C++ order matching engine, and a React frontend dashboard.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │────▶  Node.js API    │────▶  Python ML      │
│   (Dashboard)   │     │  (Orchestrator) │     │  (Predictions) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  C++ Matching   │
                        │    Engine       │
                        │ (Order Book)    │
                        └─────────────────┘
```

### Components

1. **Frontend (React)**: Trading dashboard with predictions, order book, and order placement
2. **Backend (Node.js)**: API orchestrator connecting ML service and matching engine
3. **ML Service (Python/Flask)**: LSTM and regression models for price prediction
4. **Matching Engine (C++)**: High-performance order matching with price-time priority

## Features

- **AI Predictions**: LSTM and regression models predict stock price trends
- **Investment Suggestions**: BUY, SELL, HOLD recommendations based on predictions
- **Order Matching**: Custom C++ engine with price-time priority
- **Order Book**: Real-time visualization of bid/ask levels
- **Portfolio Tracking**: Cash balance and position management
- **Trade Execution**: Partial and full order matching

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+ with pip
- C++ compiler (g++, MSVC, or Clang)
- CMake 3.14+

### Option 1: Using Startup Script

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

### Option 2: Manual Setup

1. **Install dependencies:**
```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

2. **Setup Python environment:**
```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

3. **Build C++ matching engine:**
```bash
cd matching-engine
mkdir build && cd build
cmake ..
make -j4
cd ../..
```

4. **Start services (in separate terminals):**
```bash
# Matching Engine
./matching-engine/build/matching_engine

# ML Service
cd ml-service && source venv/bin/activate && python app.py

# Backend
cd backend && node server.js

# Frontend
cd frontend && npm start
```

## Usage

1. Open http://localhost:3000 in your browser
2. Enter a stock symbol (e.g., AAPL, MSFT, GOOGL)
3. Click "Analyze" to fetch AI prediction
4. Review the trend and investment suggestion
5. Place buy/sell orders using the order form
6. Watch the order book update in real-time

## API Endpoints

### Backend API (http://localhost:3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/predict | Get price prediction |
| POST | /api/suggest | Get investment suggestion |
| GET | /api/data/:symbol | Get historical data |
| POST | /api/orders | Place order |
| GET | /api/orderbook/:symbol | Get order book |
| GET | /api/users/:userId | Get user info |

### ML Service (http://localhost:5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/predict | Generate prediction |
| POST | /api/suggest | Generate suggestion |
| GET | /api/data/:symbol | Fetch stock data |
| POST | /api/train | Train model |

## Configuration

Edit `.env` file to customize:

```
BACKEND_PORT=3001
ML_PORT=5000
MATCHING_ENGINE_PORT=9000
FRONTEND_PORT=3000
MODEL_TYPE=lstm
SEQUENCE_LENGTH=60
```

## Project Structure

```
ai-trading/
├── backend/           # Node.js API
│   ├── server.js
│   └── package.json
├── frontend/          # React app
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
├── matching-engine/   # C++ order matching
│   ├── include/
│   ├── src/
│   └── CMakeLists.txt
├── ml-service/        # Python ML service
│   ├── app.py
│   ├── model_trainer.py
│   ├── prediction_engine.py
│   └── requirements.txt
├── .env
├── start.sh
├── start.bat
└── README.md
```

## How It Works

### AI Prediction Flow

1. User enters a stock symbol
2. Backend fetches historical data from Yahoo Finance via ML service
3. ML service trains LSTM/regression models on the data
4. Model predicts next-day price and confidence score
5. Suggestion engine generates BUY/SELL/HOLD recommendation

### Order Matching Flow

1. User submits order through frontend
2. Backend validates order (balance, positions)
3. Order sent to C++ matching engine via TCP socket
4. Engine matches orders using price-time priority
5. Partial or full fills are returned to user
6. Order book updated and displayed in real-time

### Matching Engine Algorithm

- **Buy Orders**: Sorted by highest price first, then earliest time
- **Sell Orders**: Sorted by lowest price first, then earliest time
- **Matching**: Cross when buy price >= sell price
- **Execution**: Price is set by resting order
- **Partial Fills**: Supported with remaining quantity tracked

## Technologies Used

- **Frontend**: React, Recharts
- **Backend**: Node.js, Express
- **ML**: Python, Flask, TensorFlow, scikit-learn, yfinance
- **Matching Engine**: C++17, custom TCP server

## Development

### Adding New Models

Edit `ml-service/model_trainer.py` to add new model types:

```python
def _train_custom_model(self, data):
    # Your model implementation
    pass
```

### Extending Matching Engine

Edit `matching-engine/src/order_book.cpp` to modify matching logic.

### Frontend Components

Add new panels in `frontend/src/App.js` and styles in `App.css`.

## License

MIT License - See LICENSE file for details.

## Disclaimer

This is a simulation platform for educational purposes only. It does not provide financial advice. Trading involves risk, and past performance does not guarantee future results.
