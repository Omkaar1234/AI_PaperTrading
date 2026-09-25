import lightgbm  # Must be imported before sklearn/scipy on Windows to initialize runtime
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
from prediction_engine_v2 import PredictionEngineV2

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize components
model_trainer = ModelTrainer()
prediction_engine = PredictionEngine()
prediction_engine_v2 = PredictionEngineV2()

# Phase 5A: Initialize Production 21D ML Service
try:
    from production_21d_service import (
        get_production_21d_service,
        EQUITY_UNIVERSE,
        CRYPTO_UNIVERSE
    )
    prod_21d_service = get_production_21d_service()
    logger.info("Production 21D ML Service initialized successfully.")
except Exception as e:
    prod_21d_service = None
    logger.error(f"Failed to initialize Production 21D ML Service: {e}", exc_info=True)

def normalize_equity_symbol(symbol: str) -> str:
    """Normalizes input symbol strings to match canonical universe identifiers."""
    sym = symbol.strip().upper()
    if sym in ['BTC', 'BTC-USD', 'BTCUSD']:
        return 'BTC-USD'
    if sym.endswith('-USD') or sym.endswith('USDT') or 'USDT' in sym:
        return sym
    if sym.startswith('^'):
        return sym
    if sym.endswith('.NS') or sym.endswith('.BO'):
        return sym
    return f"{sym}.NS"

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
    v21d_status = "active" if (prod_21d_service and prod_21d_service.is_loaded) else "unavailable"
    v21d_broad_status = "active" if (prod_21d_service and prod_21d_service.is_broad_loaded) else "unavailable"
    return jsonify({
        "status": "healthy",
        "service": "ml-service",
        "version_21d": {
            "status": v21d_status,
            "model_version": "uprise-21d-v2.5.0",
            "strategy": "Phase 4F Strategy C"
        },
        "version_21d_broad": {
            "status": v21d_broad_status,
            "model_version": "uprise-21d-broad-v1.0.0",
            "coverage": "Broad Indian Equities (NSE/BSE, >=250 bars)"
        }
    })

@app.route('/predict', methods=['POST'])
def simple_predict():
    """
    Simple prediction endpoint for frontend PredictionCard.
    Request: { "symbol": "RELIANCE.NS" }
    Response: { "trend": "UP", "confidence": 58.29, ... }
    """
    try:
        data = request.get_json()
        if not data or 'symbol' not in data:
            return jsonify({"error": "Symbol is required"}), 400

        raw_symbol = data['symbol']
        norm_symbol = normalize_equity_symbol(raw_symbol)
        as_of_date = data.get('date') or data.get('as_of_date')

        # Crypto Isolation: Explicitly report prediction unavailable
        is_crypto = (
            norm_symbol in CRYPTO_UNIVERSE or
            'BTC' in norm_symbol.upper() or
            norm_symbol.upper().endswith('-USD') or
            norm_symbol.upper().endswith('USDT') or
            'USDT' in norm_symbol.upper()
        )
        if is_crypto:
            logger.info(f"Crypto asset requested: {raw_symbol}. Returning isolated unavailable status (/predict)")
            return jsonify({
                "symbol": raw_symbol.upper(),
                "asset": norm_symbol,
                "asset_class": "crypto",
                "status": "unavailable",
                "message": "Prediction is not currently available for cryptocurrency. The promoted 21D valuation model is strictly isolated to Indian equities.",
                "supported": False,
                "trend": "NEUTRAL",
                "signal": "NEUTRAL",
                "confidence": 0.0
            }), 200

        # Check if 21D service is available (handles both Phase 5A 7-stock and Phase 5B broad equities)
        if prod_21d_service:
            logger.info(f"Routing {raw_symbol} -> {norm_symbol} to Production 21D Service (/predict)")
            pred = prod_21d_service.predict_single_asset(norm_symbol, as_of_date=as_of_date)

            if pred.get('status') == 'unavailable':
                return jsonify({
                    "symbol": raw_symbol.upper(),
                    "asset": norm_symbol,
                    "asset_class": "equity",
                    "status": "unavailable",
                    "message": pred.get('message', 'Prediction is not currently supported for this asset.'),
                    "supported": False,
                    "trend": "NEUTRAL",
                    "signal": "NEUTRAL",
                    "confidence": 0.0,
                    "risks": pred.get('risks', [])
                }), 200

            return jsonify({
                "trend": pred['trend'],
                "confidence": pred['confidence'],
                "symbol": norm_symbol,
                "price_change_pct": pred.get('price_change_pct', 0.0),
                "predicted_price": pred.get('predicted_price', 0.0),
                "current_price": pred.get('current_price', 0.0),
                "model_version": pred.get('model_version'),
                "feature_version": pred.get('feature_version'),
                "signal": pred.get('signal'),
                "probabilities": pred.get('probabilities'),
                "expected_return_21d": pred.get('expected_return_21d'),
                "quantiles": pred.get('quantiles'),
                "uncertainty_proxy": pred.get('uncertainty_proxy'),
                "reasons": pred.get('reasons', []),
                "risks": pred.get('risks', []),
                "status": pred.get('status', 'success'),
                "message": pred.get('message', ''),
                "supported": True
            }), 200

        # Fallback if 21D service unavailable
        logger.info(f"Unsupported asset requested: {raw_symbol}. Returning unavailable status (/predict)")
        return jsonify({
            "symbol": raw_symbol.upper(),
            "asset": norm_symbol,
            "asset_class": "equity",
            "status": "unavailable",
            "message": "Prediction service is temporarily unavailable.",
            "supported": False,
            "trend": "NEUTRAL",
            "signal": "NEUTRAL",
            "confidence": 0.0
        }), 200

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/predict', methods=['POST'])
@app.route('/api/predict/21d', methods=['POST'])
def predict():
    """
    Predict future price trend for a given symbol.
    Request: { "symbol": "RELIANCE.NS" }
    Returns full Phase 5A / 5B schema + backward-compatible fields.
    """
    try:
        data = request.get_json()
        if not data or 'symbol' not in data:
            return jsonify({"error": "Symbol is required"}), 400

        raw_symbol = data['symbol']
        norm_symbol = normalize_equity_symbol(raw_symbol)
        as_of_date = data.get('date') or data.get('as_of_date')

        # Crypto Isolation: Explicitly report prediction unavailable
        is_crypto = (
            norm_symbol in CRYPTO_UNIVERSE or
            'BTC' in norm_symbol.upper() or
            norm_symbol.upper().endswith('-USD') or
            norm_symbol.upper().endswith('USDT') or
            'USDT' in norm_symbol.upper()
        )
        if is_crypto:
            logger.info(f"Crypto asset requested: {raw_symbol}. Returning isolated unavailable status (/api/predict)")
            return jsonify({
                "symbol": raw_symbol.upper(),
                "asset": norm_symbol,
                "asset_class": "crypto",
                "status": "unavailable",
                "message": "Prediction is not currently available for cryptocurrency. The promoted 21D valuation model is strictly isolated to Indian equities.",
                "supported": False,
                "trend": "NEUTRAL",
                "signal": "NEUTRAL",
                "confidence": 0.0
            }), 200

        if prod_21d_service:
            logger.info(f"Routing {raw_symbol} -> {norm_symbol} to Production 21D Service (/api/predict)")
            pred = prod_21d_service.predict_single_asset(norm_symbol, as_of_date=as_of_date)
            if pred.get('status') == 'unavailable':
                pred['supported'] = False
                return jsonify(pred), 200
            pred['supported'] = True
            pred['status'] = pred.get('status', 'success')
            return jsonify(pred), 200

        logger.info(f"Unsupported asset requested: {raw_symbol}. Returning unavailable status (/api/predict)")
        return jsonify({
            "symbol": raw_symbol.upper(),
            "asset": norm_symbol,
            "asset_class": "equity",
            "status": "unavailable",
            "message": "Prediction service is temporarily unavailable.",
            "supported": False,
            "trend": "NEUTRAL",
            "signal": "NEUTRAL",
            "confidence": 0.0
        }), 200

    except ValueError as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/portfolio/recommend', methods=['GET', 'POST'])
def portfolio_recommend():
    """
    Phase 5A / Phase 4F Strategy C Portfolio Recommendation Endpoint.
    STRICTLY ANALYTICAL RECOMMENDATION ONLY. Zero order execution.
    """
    try:
        as_of_date = None
        if request.method == 'POST':
            data = request.get_json() or {}
            as_of_date = data.get('date') or data.get('as_of_date')
        elif request.method == 'GET':
            as_of_date = request.args.get('date') or request.args.get('as_of_date')

        if prod_21d_service is None:
            return jsonify({"error": "Production 21D service is not initialized"}), 503

        recommendation = prod_21d_service.generate_portfolio_recommendation(as_of_date=as_of_date)
        return jsonify(recommendation), 200
    except Exception as e:
        logger.error(f"Portfolio recommendation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/v2/predict', methods=['POST'])
def predict_v2():
    """
    V2.1 5-trading-day asset price movement prediction endpoint.
    Request: { "symbol": "RELIANCE.NS", "assetType": "stocks" }
    """
    try:
        data = request.get_json() or {}
        symbol = data.get('symbol')
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400

        asset_type = data.get('assetType', data.get('asset_type', 'stocks'))
        result = prediction_engine_v2.predict(symbol, asset_type)
        return jsonify(result), 200

    except ValueError as e:
        logger.warning(f"V2 prediction invalid input: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"V2 prediction error: {e}", exc_info=True)
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
