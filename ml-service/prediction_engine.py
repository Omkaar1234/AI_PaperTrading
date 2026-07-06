import numpy as np
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PredictionEngine:
    """Generate predictions using trained models."""

    def __init__(self):
        self.sequence_length = 60

    def predict(self, model_data, hist_data, model_type):
        """Generate prediction for next day's price movement."""
        if model_type == 'lstm':
            return self._predict_lstm(model_data, hist_data)
        elif model_type in ['regression', 'random_forest']:
            return self._predict_regression(model_data, hist_data)
        else:
            raise ValueError(f"Unknown model type: {model_type}")

    def _predict_lstm(self, model_data, hist_data):
        """Generate prediction using LSTM model."""
        import tensorflow as tf

        model = model_data['model']
        scaler = model_data['scaler']
        feature_cols = model_data['feature_cols']

        # Prepare input sequence
        features = hist_data[feature_cols].values
        scaled = scaler.transform(features)

        # Take last sequence_length data points
        if len(scaled) >= self.sequence_length:
            last_sequence = scaled[-self.sequence_length:]
        else:
            # Pad if necessary
            padding = np.repeat(scaled[:1], self.sequence_length - len(scaled), axis=0)
            last_sequence = np.vstack([padding, scaled])

        X = np.array([last_sequence])

        # Predict
        prediction_scaled = model.predict(X, verbose=0)

        # Inverse transform to get actual price
        # Create dummy array for inverse transform
        dummy = np.zeros((1, len(feature_cols)))
        dummy[0, 0] = prediction_scaled[0, 0]  # Close price is first feature
        predicted_price = scaler.inverse_transform(dummy)[0, 0]

        current_price = hist_data['Close'].iloc[-1]

        return self._format_prediction(current_price, predicted_price)

    def _predict_regression(self, model_data, hist_data):
        """Generate prediction using regression model."""
        model = model_data['model']
        scaler = model_data['scaler']
        feature_names = model_data['feature_names']

        # Prepare features
        features = self._prepare_prediction_features(hist_data)

        # Select and order features as expected by model
        X = pd.DataFrame(index=features.index)
        for col in feature_names:
            X[col] = features.get(col, 0)

        X_scaled = scaler.transform(X.values[-1:])

        # Predict return
        predicted_return = model.predict(X_scaled)[0]

        current_price = hist_data['Close'].iloc[-1]
        predicted_price = current_price * (1 + predicted_return)

        return self._format_prediction(current_price, predicted_price)

    def _prepare_prediction_features(self, data):
        """Prepare features from latest data point."""
        df = data.copy()
        features = pd.DataFrame()

        # Price-based features
        features['close'] = df['Close']
        features['returns_1d'] = df['Close'].pct_change(1)
        features['returns_5d'] = df['Close'].pct_change(5)
        features['returns_20d'] = df['Close'].pct_change(20)

        # Volatility
        features['volatility_5d'] = df['Close'].pct_change().rolling(5).std()
        features['volatility_20d'] = df['Close'].pct_change().rolling(20).std()

        # Moving average ratios
        if 'SMA_5' in df.columns:
            features['sma_5_ratio'] = df['Close'] / df['SMA_5']
        if 'SMA_20' in df.columns:
            features['sma_20_ratio'] = df['Close'] / df['SMA_20']
        if 'SMA_50' in df.columns:
            features['sma_50_ratio'] = df['SMA_50'] / df['SMA_20'] if 'SMA_20' in df.columns else 1

        # Technical indicators
        if 'RSI' in df.columns:
            features['rsi'] = df['RSI'] / 100
        if 'MACD' in df.columns:
            features['macd'] = df['MACD'] / df['Close']
            features['macd_signal'] = df['MACD_Signal'] / df['Close']

        # Volume
        if 'Volume' in df.columns:
            features['volume'] = df['Volume'] / df['Volume'].rolling(20).mean()

        return features

    def _format_prediction(self, current_price, predicted_price):
        """Format prediction result with trend and confidence."""
        price_change = predicted_price - current_price
        price_change_pct = (price_change / current_price) * 100

        # Determine trend
        if price_change_pct > 0.5:
            trend = "UP"
        elif price_change_pct < -0.5:
            trend = "DOWN"
        else:
            trend = "NEUTRAL"

        # Calculate confidence based on magnitude of predicted change
        # Higher magnitude = higher confidence, capped at 0.95
        abs_change = abs(price_change_pct)
        confidence = min(0.5 + (abs_change / 10), 0.95) if abs_change > 0 else 0.5

        # Adjust confidence based on volatility and other factors
        confidence = self._adjust_confidence(confidence, price_change_pct)

        return {
            'trend': trend,
            'confidence': confidence,
            'price_change_pct': price_change_pct,
            'predicted_price': predicted_price,
            'current_price': current_price
        }

    def _adjust_confidence(self, base_confidence, price_change_pct):
        """Adjust confidence based on prediction characteristics."""
        confidence = base_confidence

        # Higher confidence for larger moves (but not extreme)
        abs_change = abs(price_change_pct)
        if 1 <= abs_change <= 5:
            confidence += 0.1
        elif abs_change > 10:
            confidence -= 0.15  # Lower confidence for extreme predictions

        # Cap at reasonable bounds
        return max(0.1, min(0.95, confidence))
