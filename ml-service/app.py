from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import logging
import os
from dotenv import load_dotenv

from model_trainer import ModelTrainer
from prediction_engine import PredictionEngine

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize components
model_trainer = ModelTrainer()
prediction_engine = PredictionEngine()

# Cache for models and data
model_cache = {}
data_cache = {}

def get_cache_key(symbol, model_type):
    return f"{symbol}_{model_type}"

def run_prediction(symbol, model_type='lstm', lookback_days=60):
    """Fetch data, train or reuse model, and generate a prediction."""
    hist_data = fetch_stock_data(symbol, lookback_days)
    if hist_data is None or len(hist_data) < 30:
        raise ValueError(f"Insufficient data for {symbol}")

    cache_key = get_cache_key(symbol, model_type)
    if cache_key not in model_cache:
        logger.info(f"Training new {model_type} model for {symbol}")
        model_cache[cache_key] = model_trainer.train_model(hist_data, model_type)

    model = model_cache[cache_key]
    return prediction_engine.predict(model, hist_data, model_type)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "ml-service"})

@app.route('/predict', methods=['POST'])
def simple_predict():
    """
    Simple prediction endpoint.
    Request: { "symbol": "AAPL" }
    Response: { "trend": "UP", "confidence": 0.78 }
    """
    try:
        data = request.get_json()
        if not data or 'symbol' not in data:
            return jsonify({"error": "Symbol is required"}), 400

        symbol = data['symbol'].upper()
        model_type = data.get('model_type', 'lstm')
        lookback_days = data.get('days', 60)
        logger.info(f"Simple prediction request for {symbol} using {model_type}")
        prediction = run_prediction(symbol, model_type, lookback_days)

        return jsonify({
            "trend": prediction['trend'],
            "confidence": prediction['confidence']
        })

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

def generate_dummy_prediction(symbol):
    """
    Generate a dummy prediction for demonstration.
    Uses symbol hash to make it deterministic per symbol.
    TODO: Replace with actual ML model inference.
    """
    import hashlib
    import random

    # Use symbol to create deterministic randomness
    hash_input = f"{symbol}_{datetime.now().strftime('%Y%m%d')}"
    hash_val = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)

    # Deterministic random values based on symbol
    random.seed(hash_val)
    normalized = random.random()

    # Bias toward UP slightly (55/45)
    trend = "UP" if normalized > 0.45 else "DOWN"

    # Confidence between 55% and 95%
    confidence = round(0.55 + (normalized * 0.40), 4)

    return {
        "trend": trend,
        "confidence": confidence
    }

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict future price trend for a given symbol.
    Request: { "symbol": "AAPL", "model_type": "lstm", "days": 30 }
    Response: { "symbol": "AAPL", "trend": "UP", "confidence": 0.78, "price_change_pct": 2.5 }
    """
    try:
        data = request.get_json()
        if not data or 'symbol' not in data:
            return jsonify({"error": "Symbol is required"}), 400

        symbol = data['symbol'].upper()
        model_type = data.get('model_type', 'lstm')
        lookback_days = data.get('days', 60)
        logger.info(f"Prediction request for {symbol} using {model_type} model")
        prediction = run_prediction(symbol, model_type, lookback_days)

        response = {
            "symbol": symbol,
            "trend": prediction['trend'],
            "confidence": round(prediction['confidence'], 4),
            "price_change_pct": round(prediction['price_change_pct'], 4),
            "predicted_price": round(prediction['predicted_price'], 4),
            "current_price": round(prediction['current_price'], 4),
            "model_type": model_type,
            "timestamp": datetime.now().isoformat()
        }

        return jsonify(response)

    except ValueError as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/suggest', methods=['POST'])
def suggest():
    """
    Generate investment suggestion based on prediction.
    Request: { "symbol": "AAPL", "prediction": { "trend": "UP", "confidence": 0.78 } }
    Response: { "suggestion": "BUY", "reason": "Strong upward trend predicted", "risk_level": "medium" }
    """
    try:
        data = request.get_json()
        if not data or 'prediction' not in data:
            return jsonify({"error": "Prediction data is required"}), 400

        prediction = data['prediction']
        symbol = data.get('symbol', 'UNKNOWN')

        suggestion = generate_suggestion(prediction, symbol)

        return jsonify(suggestion)

    except Exception as e:
        logger.error(f"Suggestion error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data/<symbol>', methods=['GET'])
def get_data(symbol):
    """Fetch historical stock data for a symbol."""
    try:
        days = request.args.get('days', 30, type=int)
        data = fetch_stock_data(symbol.upper(), days)

        if data is None:
            return jsonify({"error": f"No data found for {symbol}"}), 404

        # Convert to records format
        records = []
        for index, row in data.iterrows():
            records.append({
                "date": index.strftime('%Y-%m-%d'),
                "open": round(row['Open'], 4),
                "high": round(row['High'], 4),
                "low": round(row['Low'], 4),
                "close": round(row['Close'], 4),
                "volume": int(row['Volume'])
            })

        return jsonify({
            "symbol": symbol.upper(),
            "data": records
        })

    except Exception as e:
        logger.error(f"Data fetch error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/train', methods=['POST'])
def train():
    """Force retrain a model for a symbol."""
    try:
        data = request.get_json()
        symbol = data.get('symbol', '').upper()
        model_type = data.get('model_type', 'lstm')

        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400

        hist_data = fetch_stock_data(symbol, 252)  # 1 year of data
        if hist_data is None:
            return jsonify({"error": f"No data found for {symbol}"}), 404

        model = model_trainer.train_model(hist_data, model_type)
        cache_key = get_cache_key(symbol, model_type)
        model_cache[cache_key] = model

        return jsonify({
            "message": f"Model trained successfully for {symbol}",
            "model_type": model_type,
            "data_points": len(hist_data)
        })

    except Exception as e:
        logger.error(f"Training error: {str(e)}")
        return jsonify({"error": str(e)}), 500

def fetch_stock_data(symbol, days=60):
    """Fetch historical stock data from Yahoo Finance."""
    try:
        cache_key = f"data_{symbol}_{days}"

        # Simple cache check (in production use Redis)
        if cache_key in data_cache:
            cache_time, cached_data = data_cache[cache_key]
            if datetime.now() - cache_time < timedelta(minutes=15):
                return cached_data

        ticker = yf.Ticker(symbol)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days * 2)  # Extra for indicators

        df = ticker.history(start=start_date, end=end_date)

        if df.empty:
            return None

        # Add technical indicators
        df = add_indicators(df)

        # Keep only requested days
        df = df.tail(days)

        data_cache[cache_key] = (datetime.now(), df)
        return df

    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {str(e)}")
        return None

def add_indicators(df):
    """Add technical indicators to the dataframe."""
    # Moving averages
    df['SMA_5'] = df['Close'].rolling(window=5).mean()
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
    df['SMA_50'] = df['Close'].rolling(window=50).mean()

    # RSI
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = ema_12 - ema_26
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

    # Bollinger Bands
    df['BB_Middle'] = df['Close'].rolling(window=20).mean()
    bb_std = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = df['BB_Middle'] + (bb_std * 2)
    df['BB_Lower'] = df['BB_Middle'] - (bb_std * 2)

    return df

def generate_suggestion(prediction, symbol):
    """Generate investment suggestion based on prediction."""
    trend = prediction.get('trend', 'NEUTRAL')
    confidence = prediction.get('confidence', 0.5)
    price_change = prediction.get('price_change_pct', 0)

    suggestion = {
        "symbol": symbol,
        "suggestion": "HOLD",
        "reason": "",
        "risk_level": "medium",
        "confidence": confidence
    }

    # Decision logic
    if trend == "UP":
        if confidence >= 0.75:
            suggestion["suggestion"] = "STRONG_BUY"
            suggestion["reason"] = f"High confidence ({confidence:.1%}) upward trend predicted with {price_change:.2f}% expected gain"
            suggestion["risk_level"] = "low"
        elif confidence >= 0.55:
            suggestion["suggestion"] = "BUY"
            suggestion["reason"] = f"Moderate confidence ({confidence:.1%}) upward trend with {price_change:.2f}% expected gain"
            suggestion["risk_level"] = "medium"
        else:
            suggestion["suggestion"] = "WEAK_BUY"
            suggestion["reason"] = f"Low confidence ({confidence:.1%}) upward signal, consider small position"
            suggestion["risk_level"] = "high"
    elif trend == "DOWN":
        if confidence >= 0.75:
            suggestion["suggestion"] = "STRONG_SELL"
            suggestion["reason"] = f"High confidence ({confidence:.1%}) downward trend predicted with {price_change:.2f}% expected loss"
            suggestion["risk_level"] = "low"
        elif confidence >= 0.55:
            suggestion["suggestion"] = "SELL"
            suggestion["reason"] = f"Moderate confidence ({confidence:.1%}) downward trend with {price_change:.2f}% expected loss"
            suggestion["risk_level"] = "medium"
        else:
            suggestion["suggestion"] = "WEAK_SELL"
            suggestion["reason"] = f"Low confidence ({confidence:.1%}) downward signal"
            suggestion["risk_level"] = "high"
    else:
        suggestion["reason"] = f"Neutral trend detected with {confidence:.1%} confidence"
        suggestion["risk_level"] = "medium"

    return suggestion

if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
