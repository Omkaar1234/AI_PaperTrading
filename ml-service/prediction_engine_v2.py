import lightgbm  # Pin LightGBM DLL in memory before other C runtimes
import os
import json
import logging
import joblib
import time
import numpy as np
import pandas as pd

from data_pipeline import build_aligned_dataset, normalize_symbol
from features import extract_features, FEATURE_COLUMNS

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models', 'v2')

class PredictionEngineV2:
    """
    Fast V2.1 inference engine using pre-trained, persistent LightGBM models.
    Performs purely offline-trained model inference (no training inside requests).
    """

    def __init__(self, models_dir=MODELS_DIR):
        self.models_dir = models_dir
        self.classifier = None
        self.calibrator = None
        self.regressor = None
        self.lower_quantile = None
        self.upper_quantile = None
        self.manifest = None
        self.is_loaded = False
        
        self.load_models()

    def load_models(self):
        """Load pre-trained model artifacts from disk."""
        try:
            manifest_path = os.path.join(self.models_dir, 'manifest.json')
            if not os.path.exists(manifest_path):
                logger.warning(f"V2 manifest not found at {manifest_path}. V2 inference unavailable.")
                self.is_loaded = False
                return False

            with open(manifest_path, 'r') as f:
                self.manifest = json.load(f)

            self.classifier = joblib.load(os.path.join(self.models_dir, 'classifier.joblib'))
            self.calibrator = joblib.load(os.path.join(self.models_dir, 'calibrator.joblib'))
            self.regressor = joblib.load(os.path.join(self.models_dir, 'regressor.joblib'))
            self.lower_quantile = joblib.load(os.path.join(self.models_dir, 'lower_quantile.joblib'))
            self.upper_quantile = joblib.load(os.path.join(self.models_dir, 'upper_quantile.joblib'))

            self.is_loaded = True
            logger.info("V2.1 model artifacts successfully loaded into memory.")
            return True

        except Exception as e:
            logger.error(f"Failed to load V2 model artifacts: {e}")
            self.is_loaded = False
            return False

    def predict(self, symbol: str, asset_type: str = 'stocks'):
        """
        Generate 5-trading-day movement prediction using V2.1 models.
        """
        start_time = time.time()
        
        if not self.is_loaded:
            if not self.load_models():
                raise RuntimeError("V2.1 models are not loaded. Run train_v2.py to generate artifacts.")

        clean_symbol = str(symbol or '').strip().upper()
        if not clean_symbol:
            raise ValueError("Symbol is required")

        # 1. Ingest recent historical bars (up to 1 year for indicators)
        provider_symbol = normalize_symbol(clean_symbol, asset_type)
        aligned_df = build_aligned_dataset(provider_symbol, asset_type=asset_type, range_str='1y')

        if aligned_df.empty or len(aligned_df) < 30:
            raise ValueError(f"Insufficient market data available for {clean_symbol} ({provider_symbol})")

        # 2. Extract technical + market features (without target)
        feats_df = extract_features(aligned_df, include_target=False)
        if feats_df.empty:
            raise ValueError(f"Feature extraction failed for {clean_symbol}")

        # 3. Select latest row for inference
        latest_row = feats_df.iloc[-1]
        current_price = float(latest_row['Close'])
        
        if current_price <= 0:
            raise ValueError(f"Invalid current price ({current_price}) for {clean_symbol}")

        # Construct feature vector matching exact FEATURE_COLUMNS
        feature_vector = []
        for col in FEATURE_COLUMNS:
            val = latest_row.get(col, 0.0)
            if pd.isna(val) or np.isinf(val):
                val = 0.0
            feature_vector.append(float(val))

        X = np.ascontiguousarray([feature_vector], dtype=np.float64)

        # 4. Pure inference execution (sub-10ms)
        infer_start = time.time()
        
        # Class probabilities: [p_down, p_neutral, p_up]
        probs = self.classifier.predict_proba(X)[0]

        p_down = float(probs[0])
        p_neutral = float(probs[1])
        p_up = float(probs[2])

        # Direction assignment
        pred_class_idx = int(np.argmax(probs))
        class_map = {0: 'DOWN', 1: 'NEUTRAL', 2: 'UP'}
        direction = class_map.get(pred_class_idx, 'NEUTRAL')

        # Expected return (%)
        pred_return_dec = float(self.regressor.predict(X)[0])
        expected_return_pct = pred_return_dec * 100.0

        # Prediction interval quantiles (%)
        lower_return_dec = float(self.lower_quantile.predict(X)[0])
        upper_return_dec = float(self.upper_quantile.predict(X)[0])
        
        # Ensure lower <= upper
        if lower_return_dec > upper_return_dec:
            lower_return_dec, upper_return_dec = upper_return_dec, lower_return_dec

        lower_return_pct = lower_return_dec * 100.0
        upper_return_pct = upper_return_dec * 100.0

        # Expected prices
        expected_price = current_price * (1.0 + pred_return_dec)
        lower_price = current_price * (1.0 + lower_return_dec)
        upper_price = current_price * (1.0 + upper_return_dec)

        # 5. Extract top feature factors driving this prediction
        importances = self.classifier.feature_importances_
        factor_tuples = []
        for idx, col in enumerate(FEATURE_COLUMNS):
            val = feature_vector[idx]
            imp = importances[idx]
            factor_tuples.append((col, val, imp))

        # Top 4 most influential features
        top_factors = sorted(factor_tuples, key=lambda x: x[2], reverse=True)[:4]
        formatted_factors = []
        for col, val, imp in top_factors:
            formatted_factors.append({
                "name": col,
                "value": round(val, 4),
                "importance": int(imp)
            })

        inference_time_ms = round((time.time() - infer_start) * 1000, 2)
        total_time_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "symbol": clean_symbol,
            "assetType": asset_type,
            "currentPrice": round(current_price, 2),
            "horizonDays": 5,
            "direction": direction,
            "expectedReturn": round(expected_return_pct, 2),
            "expectedPrice": round(expected_price, 2),
            "predictionRange": {
                "lower": round(lower_price, 2),
                "upper": round(upper_price, 2),
                "lowerReturn": round(lower_return_pct, 2),
                "upperReturn": round(upper_return_pct, 2)
            },
            "probabilities": {
                "up": round(p_up, 4),
                "neutral": round(p_neutral, 4),
                "down": round(p_down, 4)
            },
            "factors": formatted_factors,
            "modelVersion": self.manifest.get('modelVersion', 'v2.1.1'),
            "inferenceLatencyMs": inference_time_ms,
            "totalLatencyMs": total_time_ms
        }

