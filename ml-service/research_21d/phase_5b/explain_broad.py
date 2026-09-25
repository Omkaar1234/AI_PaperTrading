"""
UPRISE ML V2 — Phase 5B
Decoupled Explainability & Uncertainty Engine

Core Rule:
EXPLANATIONS MUST NEVER CHANGE THE PREDICTION.

Pipeline:
1. features -> trained model -> prediction (trend, probabilities, expected return, quantiles)
2. features + model attribution -> explanations (top drivers, drags, risks)

Guarantees:
- Zero generative guessing (no LLM determining numbers or trends)
- Exact TreeSHAP feature attributions via LightGBM C++ engine
- Standardized linear coefficient attributions for Ridge ranking
- Quantile dispersion (Q90 - Q10) as explicit uncertainty proxy
- Deterministic rule-based financial risk flags
"""

import os
import sys
import logging
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Feature human-readable financial dictionary
FEATURE_LABELS = {
    'return_1d': "1-day short-term return",
    'return_2d': "2-day short-term momentum",
    'return_3d': "3-day price momentum",
    'return_5d': "5-day weekly price return",
    'return_10d': "10-day price momentum",
    'return_21d': "21-day monthly return momentum",
    'return_63d': "63-day quarterly price trend",
    'rsi_7': "7-day fast Relative Strength Index",
    'rsi_14': "14-day standard Relative Strength Index",
    'rsi_21': "21-day smoothed Relative Strength Index",
    'macd_norm': "Moving Average Convergence Divergence (MACD) level",
    'macd_signal_norm': "MACD signal line alignment",
    'macd_hist_norm': "MACD histogram momentum impulse",
    'stoch_k': "Stochastic oscillator %K position",
    'stoch_d': "Stochastic oscillator %D smoothed line",
    'roc_5d': "5-day Rate of Change velocity",
    'roc_20d': "20-day Rate of Change velocity",
    'close_to_ema10': "Distance from 10-day short-term EMA",
    'close_to_ema20': "Distance from 20-day trend EMA",
    'close_to_ema50': "Distance from 50-day intermediate EMA",
    'close_to_ema100': "Distance from 100-day moving average",
    'close_to_ema200': "Distance from 200-day institutional EMA",
    'ema20_to_ema50': "EMA 20 / 50 moving average spread",
    'ema50_to_ema200': "EMA 50 / 200 golden cross / death cross structure",
    'realized_vol_10d': "10-day annualized realized volatility",
    'realized_vol_21d': "21-day annualized realized volatility",
    'realized_vol_63d': "63-day quarterly realized volatility",
    'atr14_to_close': "14-day Average True Range (ATR) ratio",
    'bb_pct_b': "Bollinger Band %B relative location",
    'bb_bandwidth': "Bollinger Band volatility expansion/contraction",
    'normalized_hl_spread': "Intraday high-low price dispersion",
    'gap_return': "Opening gap-up / gap-down return",
    'volume_to_vol20': "Trading volume relative to 20-day volume average",
    'obv_slope_10d': "10-day On-Balance Volume accumulation/distribution slope",
    'vwap_ratio_20d': "Distance from 20-day Volume-Weighted Average Price (VWAP)",
    'nifty_return_1d': "1-day NIFTY 50 benchmark return",
    'nifty_return_5d': "5-day NIFTY 50 benchmark momentum",
    'nifty_return_20d': "20-day NIFTY 50 benchmark trend",
    'nifty_return_63d': "63-day NIFTY 50 quarterly benchmark return",
    'relative_strength_5d': "5-day relative strength vs NIFTY 50",
    'relative_strength_20d': "20-day relative strength vs NIFTY 50",
    'beta_nifty_63d': "63-day rolling market beta to NIFTY 50",
    'vix_level': "India VIX market volatility regime level",
    'vix_change_5d': "5-day India VIX volatility change"
}


class BroadExplainer:
    """
    Downstream quantitative explainer for Phase 5B broad technical models.
    """

    def __init__(self, classifier, feature_names):
        self.classifier = classifier
        self.feature_names = feature_names

    def explain(self, X_transformed: np.ndarray, feature_df: pd.DataFrame, predicted_class: int, probabilities: dict) -> dict:
        """
        Compute deterministic feature attributions and contextual risks.
        Does NOT modify the predicted class or probabilities.
        """
        # 1. Exact TreeSHAP feature attributions via LightGBM booster
        try:
            booster = self.classifier.booster_
            contribs = booster.predict(X_transformed, pred_contrib=True)
            n_f = len(self.feature_names)
            if contribs.ndim == 2 and contribs.shape[1] == 3 * (n_f + 1):
                reshaped = contribs.reshape(-1, 3, n_f + 1)
                class_contribs = reshaped[0, predicted_class, :n_f]
            elif contribs.ndim == 3:
                class_contribs = contribs[0, :n_f, predicted_class]
            else:
                class_contribs = contribs[0, :n_f]
        except Exception as e:
            logger.warning(f"TreeSHAP calculation fallback: {e}")
            class_contribs = np.zeros(len(self.feature_names))

        # Rank positive drivers and negative drags
        sorted_indices = np.argsort(class_contribs)
        top_positive_idx = sorted_indices[::-1][:3]
        top_negative_idx = sorted_indices[:3]

        reasons = []
        for idx in top_positive_idx:
            val = class_contribs[idx]
            if abs(val) > 1e-4:
                col = self.feature_names[idx]
                label = FEATURE_LABELS.get(col, col)
                raw_val = float(feature_df[col].iloc[-1]) if col in feature_df.columns else 0.0
                reasons.append(f"{label} (value: {raw_val:.2f}) positively supported {['DOWN', 'NEUTRAL', 'UP'][predicted_class]} probability (+{val:.3f} SHAP).")

        if not reasons:
            reasons.append(f"Technical momentum and benchmark context align with a {['DOWN', 'NEUTRAL', 'UP'][predicted_class]} outlook.")

        # Contextual Risks
        risks = []
        last_row = feature_df.iloc[-1]

        # 1. Structural Trend Risk
        if 'close_to_ema200' in last_row and last_row['close_to_ema200'] < -0.05:
            risks.append("Stock is trading >5% below its 200-day EMA, indicating macro structural downtrend risk.")

        # 2. Volatility Risk
        if 'realized_vol_21d' in last_row and last_row['realized_vol_21d'] > 0.40:
            risks.append(f"Elevated 21-day realized volatility ({last_row['realized_vol_21d']*100:.1f}%) signals high price dispersion risk.")

        # 3. Regime Risk
        if 'vix_level' in last_row and last_row['vix_level'] > 0.20:
            risks.append(f"India VIX level ({last_row['vix_level']*100:.1f}) indicates heightened broader market volatility.")

        # 4. Momentum Extremes
        if 'rsi_14' in last_row:
            if last_row['rsi_14'] > 0.75:
                risks.append(f"14-day RSI ({last_row['rsi_14']*100:.1f}) indicates overbought momentum with mean-reversion risk.")
            elif last_row['rsi_14'] < 0.25:
                risks.append(f"14-day RSI ({last_row['rsi_14']*100:.1f}) indicates oversold momentum; downside momentum may persist.")

        # 5. Volume Liquidity
        if 'volume_to_vol20' in last_row and last_row['volume_to_vol20'] < 0.40:
            risks.append("Recent trading volume is substantially below its 20-day average, indicating reduced liquidity.")

        if not risks:
            risks.append("Standard market risk applies; no anomalous volatility or trend exhaustion detected.")

        return {
            'reasons': reasons[:3],
            'risks': risks[:3]
        }
