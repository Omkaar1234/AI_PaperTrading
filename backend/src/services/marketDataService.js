const axios = require('axios');
const persistenceService = require('./persistenceService');

const memoryQuoteCache = new Map();
const memoryCandleCache = new Map();
const INDIAN_STOCK_SUFFIX = '.NS';

function inferAssetType(symbol = '') {
  if (symbol.includes('-USD') || /USDT$/i.test(symbol)) {
    return 'crypto';
  }
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
    return 'stocks';
  }
  if (symbol.endsWith('=X')) {
    return 'forex';
  }
  return 'stocks';
}

function isIndianStockSymbol(symbol = '') {
  if (!symbol) {
    return false;
  }

  return inferAssetType(symbol) === 'stocks' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO');
}

function normalizeProviderSymbol(symbol, assetType = inferAssetType(symbol)) {
  if (assetType === 'stocks' && isIndianStockSymbol(symbol)) {
    return `${symbol}${INDIAN_STOCK_SUFFIX}`;
  }

  if (assetType === 'crypto' && symbol.includes('-USD')) {
    return `${symbol.replace('-USD', '')}USDT`;
  }

  return symbol;
}

function getCacheKey(symbol, assetType, interval, range) {
  return `${symbol}:${assetType}:${interval}:${range}`;
}

function isFresh(entry, ttlMs) {
  return entry && Date.now() - entry.fetchedAt < ttlMs;
}

function normalizeQuote({ symbol, assetType, price, change, volume, timestamp, previousClose }) {
  return {
    symbol,
    assetType,
    price: Number(price || 0),
    change: Number(change || 0),
    volume: Number(volume || 0),
    previousClose: Number(previousClose || 0),
    timestamp: timestamp || new Date().toISOString()
  };
}

async function fetchYahooChart(symbol, interval = '5m', range = '1d') {
  console.log('Fetching symbol:', symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No Yahoo market data available for ${symbol}`);
  }

  return result;
}

async function fetchBinanceTicker(symbol) {
  const pair = normalizeProviderSymbol(symbol, 'crypto');
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  return normalizeQuote({
    symbol,
    assetType: 'crypto',
    price: data.lastPrice,
    change: data.priceChange,
    volume: data.volume,
    previousClose: Number(data.lastPrice) - Number(data.priceChange),
    timestamp: new Date().toISOString()
  });
}

async function fetchBinanceCandles(symbol, interval = '5m', limit = 120) {
  const pair = normalizeProviderSymbol(symbol, 'crypto');
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  return data.map((entry) => ({
    time: new Date(entry[0]).toISOString(),
    date: new Date(entry[0]).toLocaleString(),
    open: Number(entry[1]),
    high: Number(entry[2]),
    low: Number(entry[3]),
    close: Number(entry[4]),
    volume: Number(entry[5])
  }));
}

function mapRangeToYahoo(range = '1d') {
  const supported = new Set(['1d', '5d', '1mo', '3mo', '6mo']);
  return supported.has(range) ? range : '1d';
}

function mapIntervalToYahoo(interval = '5m') {
  const supported = new Set(['1m', '2m', '5m', '15m', '30m', '60m', '1d']);
  return supported.has(interval) ? interval : '5m';
}

function mapIntervalToBinance(interval = '5m') {
  const supported = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']);
  return supported.has(interval) ? interval : '5m';
}

function normalizeYahooCandles(result) {
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  return timestamps
    .map((ts, index) => ({
      time: new Date(ts * 1000).toISOString(),
      date: new Date(ts * 1000).toLocaleString(),
      open: Number(quote.open?.[index] || 0),
      high: Number(quote.high?.[index] || 0),
      low: Number(quote.low?.[index] || 0),
      close: Number(quote.close?.[index] || 0),
      volume: Number(quote.volume?.[index] || 0)
    }))
    .filter((entry) => entry.open && entry.high && entry.low && entry.close);
}

async function getQuote(symbol, assetType = inferAssetType(symbol)) {
  const cacheKey = getCacheKey(symbol, assetType, 'quote', 'snapshot');
  const cached = memoryQuoteCache.get(cacheKey);
  if (isFresh(cached, 1000)) {
    return cached.value;
  }

  let quote;
  try {
    if (assetType === 'crypto') {
      quote = await fetchBinanceTicker(symbol);
    } else {
      const providerSymbol = normalizeProviderSymbol(symbol, assetType);
      const result = await fetchYahooChart(providerSymbol, '1m', '1d');
      const meta = result.meta || {};
      const candles = normalizeYahooCandles(result);
      const last = candles.at(-1);
      const previousClose = Number(meta.previousClose || 0);
      const lastPrice = last?.close || Number(meta.regularMarketPrice || previousClose || 0);

      quote = normalizeQuote({
        symbol,
        assetType,
        price: lastPrice,
        change: lastPrice - previousClose,
        volume: last?.volume || meta.regularMarketVolume || 0,
        previousClose,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Quote fetch failed for ${symbol}:`, error.message);
    quote = {
      ...normalizeQuote({
        symbol,
        assetType,
        price: 0,
        change: 0,
        volume: 0,
        previousClose: 0,
        timestamp: new Date().toISOString()
      }),
      error: `Quote unavailable for ${symbol}`
    };
  }

  memoryQuoteCache.set(cacheKey, {
    fetchedAt: Date.now(),
    value: quote
  });

  await persistenceService.saveMarketQuote(symbol, assetType, quote, assetType === 'crypto' ? 'binance' : 'yahoo');

  return quote;
}

async function getCandles(symbol, assetType = inferAssetType(symbol), interval = '5m', range = '1d') {
  const normalizedInterval = assetType === 'crypto' ? mapIntervalToBinance(interval) : mapIntervalToYahoo(interval);
  const normalizedRange = assetType === 'crypto' ? range : mapRangeToYahoo(range);
  const cacheKey = getCacheKey(symbol, assetType, normalizedInterval, normalizedRange);
  const cached = memoryCandleCache.get(cacheKey);

  if (isFresh(cached, 2000)) {
    return cached.value;
  }

  let candles;
  let errorMessage = null;
  try {
    if (assetType === 'crypto') {
      candles = await fetchBinanceCandles(symbol, normalizedInterval, 120);
    } else {
      const providerSymbol = normalizeProviderSymbol(symbol, assetType);
      const result = await fetchYahooChart(providerSymbol, normalizedInterval, normalizedRange);
      candles = normalizeYahooCandles(result);
    }
  } catch (error) {
    console.error(`Candle fetch failed for ${symbol}:`, error.message);
    candles = [];
    errorMessage = `Candles unavailable for ${symbol}`;
  }

  const payload = {
    symbol,
    assetType,
    interval: normalizedInterval,
    range: normalizedRange,
    candles,
    ...(errorMessage ? { error: errorMessage } : {})
  };

  memoryCandleCache.set(cacheKey, {
    fetchedAt: Date.now(),
    value: payload
  });

  return payload;
}

async function getQuotes(symbols = [], assetType) {
  const safeSymbols = symbols.filter(Boolean);
  const quotes = await Promise.all(
    safeSymbols.map((symbol) => getQuote(symbol, assetType || inferAssetType(symbol)).catch((error) => ({
      symbol,
      assetType: assetType || inferAssetType(symbol),
      price: 0,
      change: 0,
      volume: 0,
      timestamp: new Date().toISOString(),
      error: error.message
    })))
  );

  return quotes;
}

module.exports = {
  getQuote,
  getQuotes,
  getCandles,
  inferAssetType,
  normalizeProviderSymbol
};
