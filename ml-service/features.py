import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

# Canonical feature columns in exact order
FEATURE_COLUMNS = [
    # Returns
    'return_1d', 'return_2d', 'return_3d', 'return_5d', 'return_10d', 'return_21d',
    # Price / Trend
    'close_to_ema20', 'close_to_ema50', 'close_to_ema200', 'ema20_to_ema50', 'ema50_to_ema200',
    # Momentum
    'rsi_7', 'rsi_14', 'rsi_21',
    'macd', 'macd_signal', 'macd_hist',
    'stoch_k', 'stoch_d',
    'roc_5d', 'roc_20d',
    # Volatility
    'atr14_to_close', 'bb_pct_b', 'bb_bandwidth', 'realized_vol_10d', 'realized_vol_30d',
    # Volume
    'volume_to_vol20', 'obv_slope_10d', 'vwap_ratio_20d',
    # Price Structure
    'normalized_hl_spread', 'gap_return',
    # Market Context
    'nifty_return_1d', 'nifty_return_5d', 'nifty_return_20d',
    'relative_strength_5d', 'vix_level', 'vix_change_5d'
]

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Relative Strength Index (strictly backward-looking)."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    # Wilder's exponential smoothing
    avg_gain = gain.ewm(alpha=1.0/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0/period, min_periods=period, adjust=False).mean()
    
    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi

def calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Average True Range (strictly backward-looking)."""
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period, min_periods=period).mean()
    return atr

def extract_features(df: pd.DataFrame, include_target: bool = True) -> pd.DataFrame:
    """
    Extract all backward-looking technical, volume, price-structure, and market context features.
    If include_target=True, also computes the 5-trading-day future return and directional label.
    """
    if df.empty or len(df) < 50:
        logger.warning(f"Dataframe too short for feature extraction ({len(df)} rows)")
        return pd.DataFrame()
        
    data = df.copy()
    close = data['Close']
    high = data['High']
    low = data['Low']
    open_p = data['Open']
    volume = data['Volume']
    
    feats = pd.DataFrame(index=data.index)
    
    # ------------------ 1. Returns ------------------
    feats['return_1d'] = close.pct_change(1)
    feats['return_2d'] = close.pct_change(2)
    feats['return_3d'] = close.pct_change(3)
    feats['return_5d'] = close.pct_change(5)
    feats['return_10d'] = close.pct_change(10)
    feats['return_21d'] = close.pct_change(21)
    
    # ------------------ 2. Price / Trend (EMAs) ------------------
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()
    
    feats['close_to_ema20'] = (close / ema20) - 1.0
    feats['close_to_ema50'] = (close / ema50) - 1.0
    feats['close_to_ema200'] = (close / ema200) - 1.0
    feats['ema20_to_ema50'] = (ema20 / ema50) - 1.0
    feats['ema50_to_ema200'] = (ema50 / ema200) - 1.0
    
    # ------------------ 3. Momentum ------------------
    feats['rsi_7'] = calculate_rsi(close, 7) / 100.0   # normalized 0-1
    feats['rsi_14'] = calculate_rsi(close, 14) / 100.0
    feats['rsi_21'] = calculate_rsi(close, 21) / 100.0
    
    # MACD (12, 26, 9) normalized by Close
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - macd_signal
    
    feats['macd'] = macd_line / (close + 1e-9)
    feats['macd_signal'] = macd_signal / (close + 1e-9)
    feats['macd_hist'] = macd_hist / (close + 1e-9)
    
    # Stochastic Oscillator (%K, %D with 14 lookback, 3 smoothing)
    low14 = low.rolling(14, min_periods=14).min()
    high14 = high.rolling(14, min_periods=14).max()
    stoch_k = 100.0 * (close - low14) / (high14 - low14 + 1e-9)
    feats['stoch_k'] = stoch_k / 100.0  # normalized 0-1
    feats['stoch_d'] = stoch_k.rolling(3, min_periods=3).mean() / 100.0
    
    # Rate of Change (ROC)
    feats['roc_5d'] = close.pct_change(5)
    feats['roc_20d'] = close.pct_change(20)
    
    # ------------------ 4. Volatility ------------------
    atr14 = calculate_atr(high, low, close, 14)
    feats['atr14_to_close'] = atr14 / (close + 1e-9)
    
    # Bollinger Bands (20-day, 2 std)
    bb_mid = close.rolling(20, min_periods=20).mean()
    bb_std = close.rolling(20, min_periods=20).std()
    bb_upper = bb_mid + 2.0 * bb_std
    bb_lower = bb_mid - 2.0 * bb_std
    feats['bb_pct_b'] = (close - bb_lower) / (bb_upper - bb_lower + 1e-9)
    feats['bb_bandwidth'] = (bb_upper - bb_lower) / (bb_mid + 1e-9)
    
    # Realized Volatility (annualized standard deviation of daily log returns)
    log_ret = np.log(close / close.shift(1))
    feats['realized_vol_10d'] = log_ret.rolling(10, min_periods=10).std() * np.sqrt(252)
    feats['realized_vol_30d'] = log_ret.rolling(30, min_periods=30).std() * np.sqrt(252)
    
    # ------------------ 5. Volume ------------------
    vol_mean20 = volume.rolling(20, min_periods=20).mean()
    feats['volume_to_vol20'] = volume / (vol_mean20 + 1e-9)
    
    # On-Balance Volume (OBV) slope over 10 days
    price_direction = np.sign(close.diff()).fillna(0)
    obv = (price_direction * volume).cumsum()
    vol_sum10 = volume.rolling(10, min_periods=10).sum()
    feats['obv_slope_10d'] = (obv - obv.shift(10)) / (vol_sum10 + 1e-9)
    
    # 20-day typical price VWAP ratio
    typical_price = (high + low + close) / 3.0
    cum_tp_vol = (typical_price * volume).rolling(20, min_periods=20).sum()
    cum_vol = volume.rolling(20, min_periods=20).sum()
    vwap20 = cum_tp_vol / (cum_vol + 1e-9)
    feats['vwap_ratio_20d'] = (close / (vwap20 + 1e-9)) - 1.0
    
    # ------------------ 6. Price Structure ------------------
    feats['normalized_hl_spread'] = (high - low) / (close + 1e-9)
    feats['gap_return'] = (open_p - close.shift(1)) / (close.shift(1) + 1e-9)
    
    # ------------------ 7. Market Context ------------------
    if 'NIFTY_Close' in data.columns:
        nifty_close = data['NIFTY_Close']
        feats['nifty_return_1d'] = nifty_close.pct_change(1)
        feats['nifty_return_5d'] = nifty_close.pct_change(5)
        feats['nifty_return_20d'] = nifty_close.pct_change(20)
        feats['relative_strength_5d'] = feats['return_5d'] - feats['nifty_return_5d']
    else:
        feats['nifty_return_1d'] = 0.0
        feats['nifty_return_5d'] = 0.0
        feats['nifty_return_20d'] = 0.0
        feats['relative_strength_5d'] = 0.0
        
    if 'VIX_Close' in data.columns:
        vix = data['VIX_Close']
        feats['vix_level'] = vix / 100.0  # normalized
        feats['vix_change_5d'] = vix.pct_change(5)
    else:
        feats['vix_level'] = 0.15
        feats['vix_change_5d'] = 0.0
        
    # Append raw Close and Volume for reference
    feats['Close'] = close
    feats['Volume'] = volume
    
    # ------------------ 8. Target Generation (If requested) ------------------
    if include_target:
        # Future close at t+5
        future_close = close.shift(-5)
        future_return = (future_close - close) / close
        
        feats['target_future_return'] = future_return
        feats['target_future_price'] = future_close
        
        # Directional Label:
        # UP (2) if return > +1% (+0.01)
        # DOWN (0) if return < -1% (-0.01)
        # NEUTRAL (1) if -1% <= return <= +1%
        direction = pd.Series(index=feats.index, dtype='float64')
        direction[(future_return >= -0.01) & (future_return <= 0.01)] = 1  # NEUTRAL
        direction[future_return > 0.01] = 2   # UP
        direction[future_return < -0.01] = 0  # DOWN
        
        feats['target_direction'] = direction
        
    return feats

