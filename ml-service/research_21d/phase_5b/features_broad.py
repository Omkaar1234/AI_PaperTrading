"""
UPRISE ML V2 — Phase 5B
Broad Technical & Market Feature Pipeline

Extracts strictly backward-looking technical, momentum, volatility,
volume, and market benchmark (NIFTY 50 & India VIX) features.

Guarantees:
- Zero forward-looking operations (no lookahead bias)
- Programmatic feature manifest generation with SHA-256 hash verification
- Explicit loud failure on feature shape or column ordering discrepancy
"""

import os
import sys
import json
import hashlib
import logging
import pandas as pd
import numpy as np

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURE_MANIFEST_PATH = os.path.join(CURRENT_DIR, 'feature_manifest.json')
FEATURE_SET_VERSION = "uprise-broad-tech-v1.0.0"


class FoldPreprocessor:
    """Strictly training-isolated preprocessing transformer."""
    def __init__(self):
        self.imputer = SimpleImputer(strategy='median')
        self.scaler = RobustScaler()
        self.q005 = None
        self.q995 = None
        self.is_fitted = False

    def fit(self, X: pd.DataFrame):
        X_mat = self.imputer.fit_transform(X)
        self.q005 = np.percentile(X_mat, 0.5, axis=0)
        self.q995 = np.percentile(X_mat, 99.5, axis=0)
        X_clipped = np.clip(X_mat, self.q005, self.q995)
        self.scaler.fit(X_clipped)
        self.is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted on training data before transforming.")
        X_mat = self.imputer.transform(X)
        X_clipped = np.clip(X_mat, self.q005, self.q995)
        return self.scaler.transform(X_clipped)

    def fit_transform(self, X: pd.DataFrame) -> np.ndarray:
        return self.fit(X).transform(X)



def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Wilder's Relative Strength Index (strictly backward-looking)."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    return 100.0 - (100.0 / (1.0 + rs))


def calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Average True Range (strictly backward-looking)."""
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=period).mean()


def extract_broad_features(stock_df: pd.DataFrame, nifty_df: pd.DataFrame, vix_df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract backward-looking broad technical and market features.
    stock_df, nifty_df, vix_df must all be indexed by normalized daily DatetimeIndex.
    """
    if stock_df.empty or len(stock_df) < 50:
        return pd.DataFrame()

    df = stock_df.copy().sort_index()
    close = df['Close']
    high = df['High']
    low = df['Low']
    open_p = df['Open']
    volume = df['Volume']

    feats = pd.DataFrame(index=df.index)

    # 1. Returns & Momentum
    feats['return_1d'] = close.pct_change(1)
    feats['return_2d'] = close.pct_change(2)
    feats['return_3d'] = close.pct_change(3)
    feats['return_5d'] = close.pct_change(5)
    feats['return_10d'] = close.pct_change(10)
    feats['return_21d'] = close.pct_change(21)
    feats['return_63d'] = close.pct_change(63)

    feats['rsi_7'] = calculate_rsi(close, 7) / 100.0
    feats['rsi_14'] = calculate_rsi(close, 14) / 100.0
    feats['rsi_21'] = calculate_rsi(close, 21) / 100.0

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - macd_signal

    feats['macd_norm'] = macd_line / (close + 1e-9)
    feats['macd_signal_norm'] = macd_signal / (close + 1e-9)
    feats['macd_hist_norm'] = macd_hist / (close + 1e-9)

    low14 = low.rolling(14, min_periods=14).min()
    high14 = high.rolling(14, min_periods=14).max()
    stoch_k = 100.0 * (close - low14) / (high14 - low14 + 1e-9)
    feats['stoch_k'] = stoch_k / 100.0
    feats['stoch_d'] = stoch_k.rolling(3, min_periods=3).mean() / 100.0

    feats['roc_5d'] = close.pct_change(5)
    feats['roc_20d'] = close.pct_change(20)

    # 2. Trend & Moving Averages
    ema10 = close.ewm(span=10, adjust=False).mean()
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema100 = close.ewm(span=100, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()

    feats['close_to_ema10'] = (close / ema10) - 1.0
    feats['close_to_ema20'] = (close / ema20) - 1.0
    feats['close_to_ema50'] = (close / ema50) - 1.0
    feats['close_to_ema100'] = (close / ema100) - 1.0
    feats['close_to_ema200'] = (close / ema200) - 1.0

    feats['ema20_to_ema50'] = (ema20 / ema50) - 1.0
    feats['ema50_to_ema200'] = (ema50 / ema200) - 1.0

    # 3. Volatility & Price Structure
    log_ret = np.log(close / close.shift(1).clip(lower=1e-9))
    feats['realized_vol_10d'] = log_ret.rolling(10, min_periods=10).std() * np.sqrt(252)
    feats['realized_vol_21d'] = log_ret.rolling(21, min_periods=21).std() * np.sqrt(252)
    feats['realized_vol_63d'] = log_ret.rolling(63, min_periods=63).std() * np.sqrt(252)

    atr14 = calculate_atr(high, low, close, 14)
    feats['atr14_to_close'] = atr14 / (close + 1e-9)

    bb_mid = close.rolling(20, min_periods=20).mean()
    bb_std = close.rolling(20, min_periods=20).std()
    bb_upper = bb_mid + 2.0 * bb_std
    bb_lower = bb_mid - 2.0 * bb_std
    feats['bb_pct_b'] = (close - bb_lower) / (bb_upper - bb_lower + 1e-9)
    feats['bb_bandwidth'] = (bb_upper - bb_lower) / (bb_mid + 1e-9)

    feats['normalized_hl_spread'] = (high - low) / (close + 1e-9)
    feats['gap_return'] = (open_p - close.shift(1)) / (close.shift(1).clip(lower=1e-9))

    # 4. Volume Dynamics
    vol_mean20 = volume.rolling(20, min_periods=20).mean()
    feats['volume_to_vol20'] = volume / (vol_mean20 + 1e-9)

    price_dir = np.sign(close.diff()).fillna(0)
    obv = (price_dir * volume).cumsum()
    vol_sum10 = volume.rolling(10, min_periods=10).sum()
    feats['obv_slope_10d'] = (obv - obv.shift(10)) / (vol_sum10 + 1e-9)

    typical_price = (high + low + close) / 3.0
    cum_tp_vol = (typical_price * volume).rolling(20, min_periods=20).sum()
    cum_vol = volume.rolling(20, min_periods=20).sum()
    vwap20 = cum_tp_vol / (cum_vol + 1e-9)
    feats['vwap_ratio_20d'] = (close / (vwap20 + 1e-9)) - 1.0

    # 5. Market Benchmark & Context
    # Align NIFTY and VIX
    nifty_c = nifty_df['Close'].reindex(df.index).ffill()
    vix_c = vix_df['Close'].reindex(df.index).ffill()

    feats['nifty_return_1d'] = nifty_c.pct_change(1)
    feats['nifty_return_5d'] = nifty_c.pct_change(5)
    feats['nifty_return_20d'] = nifty_c.pct_change(20)
    feats['nifty_return_63d'] = nifty_c.pct_change(63)

    feats['relative_strength_5d'] = feats['return_5d'] - feats['nifty_return_5d']
    feats['relative_strength_20d'] = feats['return_21d'] - feats['nifty_return_20d']

    # 63-day rolling beta to NIFTY
    ret_stock = feats['return_1d']
    ret_nifty = feats['nifty_return_1d']
    cov_63 = ret_stock.rolling(63, min_periods=30).cov(ret_nifty)
    var_nifty_63 = ret_nifty.rolling(63, min_periods=30).var()
    feats['beta_nifty_63d'] = cov_63 / (var_nifty_63 + 1e-9)

    feats['vix_level'] = vix_c / 100.0
    feats['vix_change_5d'] = vix_c.pct_change(5)

    return feats


def generate_feature_manifest(feature_df: pd.DataFrame) -> dict:
    """
    Programmatically analyze feature dataframe, compute summary statistics,
    and output canonical feature manifest.
    """
    col_names = list(feature_df.columns)
    exact_count = len(col_names)
    
    # Hash of canonical ordered column names
    hasher = hashlib.sha256()
    hasher.update(",".join(col_names).encode('utf-8'))
    col_hash = hasher.hexdigest()

    dtypes_dict = {col: str(feature_df[col].dtype) for col in col_names}
    missing_dict = {col: round(float(feature_df[col].isna().mean() * 100), 2) for col in col_names}
    
    summary_dict = {}
    for col in col_names:
        s = feature_df[col].dropna()
        if len(s) > 0:
            summary_dict[col] = {
                'min': round(float(s.min()), 6),
                'max': round(float(s.max()), 6),
                'median': round(float(s.median()), 6),
                'q01': round(float(s.quantile(0.01)), 6),
                'q05': round(float(s.quantile(0.05)), 6),
                'q25': round(float(s.quantile(0.25)), 6),
                'q75': round(float(s.quantile(0.75)), 6),
                'q95': round(float(s.quantile(0.95)), 6),
                'q99': round(float(s.quantile(0.99)), 6)
            }
        else:
            summary_dict[col] = {}

    manifest = {
        'feature_set_version': FEATURE_SET_VERSION,
        'exact_feature_count': exact_count,
        'feature_set_sha256': col_hash,
        'ordered_feature_names': col_names,
        'dtypes': dtypes_dict,
        'missing_percentages': missing_dict,
        'distribution_summary': summary_dict
    }

    with open(FEATURE_MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    logger.info(f"Feature manifest written to {FEATURE_MANIFEST_PATH}")
    logger.info(f"Exact feature count: {exact_count}")
    logger.info(f"Feature set SHA-256: {col_hash}")
    return manifest


def validate_features(df: pd.DataFrame, manifest_path: str = FEATURE_MANIFEST_PATH):
    """
    Loud failure validation: asserts dataframe exactly matches manifest columns and order.
    """
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Feature manifest not found at {manifest_path}")

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    expected_count = manifest['exact_feature_count']
    expected_cols = manifest['ordered_feature_names']
    actual_cols = list(df.columns)

    if len(actual_cols) != expected_count:
        raise ValueError(
            f"LOUD FAILURE: Feature count mismatch! Expected {expected_count} features, "
            f"but received {len(actual_cols)} columns."
        )

    if actual_cols != expected_cols:
        mismatches = [(i, exp, act) for i, (exp, act) in enumerate(zip(expected_cols, actual_cols)) if exp != act]
        raise ValueError(
            f"LOUD FAILURE: Feature column ordering mismatch! {len(mismatches)} discrepancies detected. "
            f"First mismatch at index {mismatches[0][0]}: expected '{mismatches[0][1]}', got '{mismatches[0][2]}'."
        )

    return True


if __name__ == '__main__':
    # Test feature extraction on sample cached stock and write manifest
    from build_universe import DATA_DIR
    nifty_df = pd.read_pickle(os.path.join(DATA_DIR, 'NSEI_5y.pkl'))
    vix_df = pd.read_pickle(os.path.join(DATA_DIR, 'INDIAVIX_5y.pkl'))
    sample_df = pd.read_pickle(os.path.join(DATA_DIR, 'RELIANCE_NS_5y.pkl'))

    feats = extract_broad_features(sample_df, nifty_df, vix_df)
    logger.info(f"Extracted features shape: {feats.shape}")
    manifest = generate_feature_manifest(feats)
    validate_features(feats)
    logger.info("Validation passed: Feature dataframe perfectly matches manifest!")
