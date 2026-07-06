import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelTrainer:
    """Train ML models for stock price prediction."""

    def __init__(self):
        self.sequence_length = int(os.environ.get('SEQUENCE_LENGTH', 60))

    def train_model(self, data, model_type='lstm'):
        """Train a model based on the specified type."""
        if model_type == 'lstm':
            return self._train_lstm(data)
        elif model_type == 'regression':
            return self._train_regression(data)
        elif model_type == 'random_forest':
            return self._train_random_forest(data)
        else:
            raise ValueError(f"Unknown model type: {model_type}")

    def _train_lstm(self, data):
        """Train an LSTM model for time series prediction."""
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
            from tensorflow.keras.callbacks import EarlyStopping

            # Prepare data
            features = self._prepare_lstm_features(data)
            X, y = self._create_sequences(features, target_idx=0)  # Close price is first feature

            if len(X) < 10:
                logger.warning("Not enough data for LSTM, falling back to regression")
                return self._train_regression(data)

            # Build LSTM model
            model = Sequential([
                Input(shape=(X.shape[1], X.shape[2])),
                LSTM(50, return_sequences=True),
                Dropout(0.2),
                LSTM(50, return_sequences=False),
                Dropout(0.2),
                Dense(25),
                Dense(1)
            ])

            model.compile(optimizer='adam', loss='mean_squared_error')

            # Early stopping
            early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

            # Train with validation split
            model.fit(
                X, y,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stop],
                verbose=0
            )

            return {
                'model': model,
                'scaler': self.lstm_scaler,
                'feature_cols': self.lstm_feature_cols,
                'type': 'lstm'
            }

        except ImportError:
            logger.warning("TensorFlow not available, falling back to regression")
            return self._train_regression(data)
        except Exception as e:
            logger.error(f"LSTM training failed: {e}, falling back to regression")
            return self._train_regression(data)

    def _train_regression(self, data):
        """Train a Ridge regression model with technical indicators."""
        features = self._prepare_regression_features(data)

        # Target: next day's return
        features['target'] = features['close'].shift(-1) / features['close'] - 1
        features = features.dropna()

        if len(features) < 10:
            raise ValueError("Insufficient data for regression training")

        X = features.drop(['target', 'close'], axis=1)
        y = features['target']

        # Scale features
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)

        # Train model
        model = Ridge(alpha=1.0)
        model.fit(X_scaled, y)

        return {
            'model': model,
            'scaler': scaler,
            'feature_names': X.columns.tolist(),
            'last_close': features['close'].iloc[-1],
            'type': 'regression'
        }

    def _train_random_forest(self, data):
        """Train a Random Forest model."""
        features = self._prepare_regression_features(data)

        features['target'] = features['close'].shift(-1) / features['close'] - 1
        features = features.dropna()

        X = features.drop(['target', 'close'], axis=1)
        y = features['target']

        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)

        model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
        model.fit(X_scaled, y)

        return {
            'model': model,
            'scaler': scaler,
            'feature_names': X.columns.tolist(),
            'last_close': features['close'].iloc[-1],
            'type': 'random_forest'
        }

    def _prepare_lstm_features(self, data):
        """Prepare features for LSTM model."""
        df = data.copy()

        feature_cols = ['Close', 'Volume', 'SMA_5', 'SMA_20', 'RSI', 'MACD']

        # Select available columns
        available_cols = [c for c in feature_cols if c in df.columns]
        if len(available_cols) < 3:
            available_cols = ['Close', 'Volume']

        features = df[available_cols].values

        # Scale features
        self.lstm_scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = self.lstm_scaler.fit_transform(features)

        self.lstm_feature_cols = available_cols
        return scaled

    def _prepare_regression_features(self, data):
        """Prepare features for regression model."""
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
            features['rsi'] = df['RSI'] / 100  # Normalize to 0-1
        if 'MACD' in df.columns:
            features['macd'] = df['MACD'] / df['Close']
            features['macd_signal'] = df['MACD_Signal'] / df['Close']

        # Volume
        if 'Volume' in df.columns:
            features['volume'] = df['Volume'] / df['Volume'].rolling(20).mean()

        return features

    def _create_sequences(self, data, target_idx=0):
        """Create sequences for LSTM training."""
        X, y = [], []
        seq_len = self.sequence_length

        for i in range(seq_len, len(data)):
            X.append(data[i-seq_len:i])
            y.append(data[i, target_idx])

        return np.array(X), np.array(y)
