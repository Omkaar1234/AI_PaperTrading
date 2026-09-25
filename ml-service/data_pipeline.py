import os
import logging
import requests
import pandas as pd
import numpy as np
from datetime import datetime

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def normalize_symbol(symbol: str, asset_type: str = 'stocks') -> str:
    """Normalize symbol to the provider format (Yahoo Finance)."""
    s = str(symbol or '').strip().upper()
    if not s:
        return s
    
    asset_type = str(asset_type or '').lower()
    
    # Crypto normalization
    if asset_type == 'crypto' or 'USDT' in s or '-USD' in s:
        if s.endswith('USDT'):
            return f"{s[:-4]}-USD"
        if not s.endswith('-USD'):
            return f"{s}-USD"
        return s
    
    # Forex normalization
    if asset_type == 'forex' or s.endswith('=X'):
        if not s.endswith('=X'):
            return f"{s}=X"
        return s
    
    # Benchmark indices
    if s.startswith('^'):
        return s
        
    # Indian equities normalization
    if s.endswith('.NS') or s.endswith('.BO'):
        return s
    
    # Default to NSE (.NS) for plain Indian equity symbols
    return f"{s}.NS"

def fetch_yahoo_chart(symbol: str, range_str: str = '5y', interval: str = '1d') -> pd.DataFrame:
    """
    Fetch historical OHLCV data directly from Yahoo Finance Chart API.
    Does not require external credentials and reliably provides split/dividend adjusted prices.
    """
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{requests.utils.quote(symbol)}?interval={interval}&range={range_str}&includePrePost=false"
    
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        results = data.get('chart', {}).get('result')
        if not results or len(results) == 0:
            logger.warning(f"No chart data found for {symbol}")
            return pd.DataFrame()
            
        chart_data = results[0]
        timestamps = chart_data.get('timestamp', [])
        if not timestamps:
            logger.warning(f"No timestamps found for {symbol}")
            return pd.DataFrame()
            
        indicators = chart_data.get('indicators', {})
        quotes = indicators.get('quote', [{}])[0]
        adjcloses = indicators.get('adjclose', [{}])[0].get('adjclose', [])
        
        opens = quotes.get('open', [])
        highs = quotes.get('high', [])
        lows = quotes.get('low', [])
        closes = quotes.get('close', [])
        volumes = quotes.get('volume', [])
        
        # Build raw DataFrame
        df = pd.DataFrame({
            'timestamp': timestamps,
            'open': opens,
            'high': highs,
            'low': lows,
            'close': closes,
            'volume': volumes
        })
        
        if adjcloses and len(adjcloses) == len(df):
            df['adjclose'] = adjcloses
        else:
            df['adjclose'] = df['close']
            
        # Convert timestamp to timezone-naive Date normalized to midnight
        df['date'] = pd.to_datetime(df['timestamp'], unit='s', utc=True).dt.tz_localize(None).dt.normalize()
        
        # Data validation and cleaning:
        # 1. Drop rows where close or open is missing / NaN / non-positive
        df = df.dropna(subset=['open', 'high', 'low', 'close'])
        df = df[(df['close'] > 0) & (df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0)]
        
        # 2. Fill missing volume with 0
        df['volume'] = df['volume'].fillna(0).astype(float)
        
        # 3. Sort chronologically and drop duplicate dates (keep last)
        df = df.sort_values('date').drop_duplicates(subset=['date'], keep='last').reset_index(drop=True)
        
        # Set Date as index
        df = df.set_index('date')
        
        # Rename columns to standard uppercase OHLCV
        df = df[['open', 'high', 'low', 'close', 'adjclose', 'volume']].rename(columns={
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'adjclose': 'Adj Close',
            'volume': 'Volume'
        })
        
        return df
        
    except Exception as e:
        logger.error(f"Error fetching Yahoo Chart data for {symbol}: {e}")
        return pd.DataFrame()

def fetch_market_context(range_str: str = '5y') -> pd.DataFrame:
    """
    Fetch NIFTY 50 (^NSEI) and India VIX (^INDIAVIX) for benchmark market context.
    """
    nifty_df = fetch_yahoo_chart('^NSEI', range_str=range_str)
    vix_df = fetch_yahoo_chart('^INDIAVIX', range_str=range_str)
    
    if nifty_df.empty:
        logger.warning("NIFTY 50 benchmark data could not be fetched.")
        return pd.DataFrame()
        
    market_df = pd.DataFrame(index=nifty_df.index)
    market_df['NIFTY_Close'] = nifty_df['Close']
    market_df['NIFTY_Volume'] = nifty_df['Volume']
    
    if not vix_df.empty:
        market_df = market_df.join(vix_df[['Close']].rename(columns={'Close': 'VIX_Close'}), how='left')
        # Forward fill VIX up to 2 trading days for small date mismatches, then backward fill
        market_df['VIX_Close'] = market_df['VIX_Close'].ffill(limit=2).bfill()
    else:
        # Fallback if VIX is unavailable
        market_df['VIX_Close'] = 15.0
        
    return market_df

def build_aligned_dataset(symbol: str, asset_type: str = 'stocks', range_str: str = '5y') -> pd.DataFrame:
    """
    Fetch asset OHLCV and align with market benchmark context.
    Ensures strict chronological ordering and returns a combined DataFrame.
    """
    provider_symbol = normalize_symbol(symbol, asset_type)
    asset_df = fetch_yahoo_chart(provider_symbol, range_str=range_str)
    
    if asset_df.empty or len(asset_df) < 50:
        logger.warning(f"Insufficient historical data ({len(asset_df)} rows) for {symbol} ({provider_symbol})")
        return pd.DataFrame()
        
    # Fetch market context (NIFTY + VIX)
    market_df = fetch_market_context(range_str=range_str)
    
    if not market_df.empty:
        combined = asset_df.join(market_df, how='left')
        # Forward fill market context for minor trading holiday mismatches
        combined['NIFTY_Close'] = combined['NIFTY_Close'].ffill().bfill()
        combined['NIFTY_Volume'] = combined['NIFTY_Volume'].fillna(0)
        combined['VIX_Close'] = combined['VIX_Close'].ffill().bfill()
    else:
        combined = asset_df.copy()
        combined['NIFTY_Close'] = combined['Close']
        combined['NIFTY_Volume'] = combined['Volume']
        combined['VIX_Close'] = 15.0
        
    return combined

