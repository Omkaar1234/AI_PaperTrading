import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, ASSET_TYPES } from '../constants';

const DEFAULT_WATCHLIST = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS'];

function logApiFailure(context, error) {
  console.error(`[API FAILURE] ${context}`, {
    message: error?.message,
    status: error?.response?.status,
    data: error?.response?.data
  });
}

function inferAssetType(symbol = '') {
  if (symbol.includes('-USD') || /USDT$/i.test(symbol)) {
    return ASSET_TYPES.CRYPTO;
  }
  if (symbol.endsWith('=X')) {
    return ASSET_TYPES.FOREX;
  }
  return ASSET_TYPES.STOCKS;
}

function normalizeSymbolItems(items = []) {
  return items.map((item) => ({
    ...item,
    symbol: String(item.symbol || '').toUpperCase(),
    assetType: item.assetType || (item.type === 'crypto' ? ASSET_TYPES.CRYPTO : inferAssetType(item.symbol)),
    type: item.type || (inferAssetType(item.symbol) === ASSET_TYPES.CRYPTO ? 'crypto' : 'stock')
  }));
}

function normalizeWatchlistSymbols(symbols = []) {
  return symbols
    .map((entry) => (typeof entry === 'string' ? entry : entry.symbol))
    .filter(Boolean)
    .map((symbol) => String(symbol).trim().toUpperCase());
}

function buildPositionsFromOrders(orders = [], quoteMap = {}) {
  const posMap = {};

  const sortedOrders = [...orders].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  sortedOrders.forEach((order) => {
    const filledQty = Number(order.filled_qty || 0);
    if (!filledQty) {
      return;
    }

    if (!posMap[order.symbol]) {
      posMap[order.symbol] = {
        symbol: order.symbol,
        quantity: 0,
        avgPrice: 0,
        invested: 0,
        marketPrice: quoteMap[order.symbol]?.price || order.avg_fill_price || order.price || 0,
        marketValue: 0,
        unrealizedPnl: 0,
        realizedPnl: 0
      };
    }

    const fillPrice = Number(order.avg_fill_price || order.price || 0);

    if (order.side === 'BUY') {
      posMap[order.symbol].quantity += filledQty;
      posMap[order.symbol].invested += filledQty * fillPrice;
      posMap[order.symbol].avgPrice = posMap[order.symbol].quantity > 0
        ? posMap[order.symbol].invested / posMap[order.symbol].quantity
        : 0;
    } else if (order.side === 'SELL') {
      const currentAvg = posMap[order.symbol].avgPrice || 0;
      const costBasisDeducted = filledQty * currentAvg;
      posMap[order.symbol].quantity = Math.max(0, posMap[order.symbol].quantity - filledQty);
      posMap[order.symbol].invested = Math.max(0, posMap[order.symbol].invested - costBasisDeducted);
      posMap[order.symbol].realizedPnl = (posMap[order.symbol].realizedPnl || 0) + (filledQty * (fillPrice - currentAvg));
      if (posMap[order.symbol].quantity === 0) {
        posMap[order.symbol].avgPrice = 0;
        posMap[order.symbol].invested = 0;
      }
    }
  });

  return Object.values(posMap)
    .filter((position) => position.quantity > 0)
    .map((position) => {
      const livePrice = quoteMap[position.symbol]?.price || position.marketPrice || position.avgPrice;
      const marketValue = position.quantity * livePrice;
      return {
        ...position,
        marketPrice: livePrice,
        marketValue,
        unrealizedPnl: marketValue - position.invested
      };
    });
}

export function useTradingData(authenticatedUser) {
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetType, setAssetType] = useState(ASSET_TYPES.STOCKS);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [tradeMode, setTradeMode] = useState('BUY');
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [tradePrice, setTradePrice] = useState('');
  const [orderType, setOrderType] = useState('MARKET');
  const [tradeSuccess, setTradeSuccess] = useState(null);
  const [assetInfo, setAssetInfo] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  const [prediction, setPrediction] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [orderBookLoading, setOrderBookLoading] = useState(false);
  const [orderBookError, setOrderBookError] = useState(null);
  const [orderBookLastUpdated, setOrderBookLastUpdated] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [marketQuotes, setMarketQuotes] = useState({});
  const [chartInterval, setChartInterval] = useState('5m');
  const [chartRange, setChartRange] = useState('1d');
  const [activeDockTab, setActiveDockTab] = useState('positions');
  const [portfolio, setPortfolio] = useState(null);
  const [symbolDirectory, setSymbolDirectory] = useState({});
  const activeUserId = authenticatedUser?.id;
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);

  const wsRef = useRef(null);
  const latestSelectionRef = useRef(null);
  const selectedSymbolRef = useRef(null);
  const marketQuotesRef = useRef({});
  const priceChangeRef = useRef({ value: 0, percent: 0 });
  const streamedSymbols = useMemo(() => {
    const symbols = new Set(watchlist);
    if (selectedAsset?.symbol) {
      symbols.add(selectedAsset.symbol);
    }
    positions.forEach((p) => {
      if (p.symbol && p.quantity > 0) {
        symbols.add(p.symbol);
      }
    });
    return Array.from(symbols);
  }, [selectedAsset?.symbol, watchlist, positions]);

  const flashTradeMessage = (message) => {
    setTradeSuccess(message);
    if (window.__paperTradeFlashTimer) {
      window.clearTimeout(window.__paperTradeFlashTimer);
    }
    window.__paperTradeFlashTimer = window.setTimeout(() => setTradeSuccess(null), 3500);
  };

  const upsertSymbols = useCallback((items = []) => {
    const normalizedItems = normalizeSymbolItems(items);
    if (!normalizedItems.length) {
      return [];
    }

    setSymbolDirectory((current) => {
      const next = { ...current };
      normalizedItems.forEach((item) => {
        next[item.symbol] = {
          ...current[item.symbol],
          ...item
        };
      });
      return next;
    });

    return normalizedItems;
  }, []);

  const fetchSymbols = useCallback(async (options = {}) => {
    const response = await axios.get(`${API_BASE_URL}/api/symbols`, { params: options });
    const normalized = upsertSymbols(response.data.symbols || []);
    return {
      symbols: normalized,
      pagination: response.data.pagination || null
    };
  }, [upsertSymbols]);

  const lookupSymbols = useCallback(async (query, options = {}) => {
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) {
      return [];
    }

    const response = await axios.get(`${API_BASE_URL}/api/search`, {
      params: {
        q: trimmedQuery,
        limit: options.limit || 8,
        type: options.type,
        exchange: options.exchange
      }
    });

    return upsertSymbols(response.data.symbols || []);
  }, [upsertSymbols]);

  const resolveAsset = useCallback(async (symbolOrAsset) => {
    if (!symbolOrAsset) {
      return null;
    }

    if (typeof symbolOrAsset === 'object' && symbolOrAsset.symbol) {
      const [asset] = upsertSymbols([symbolOrAsset]);
      return asset;
    }

    const normalizedSymbol = String(symbolOrAsset).trim().toUpperCase();
    if (symbolDirectory[normalizedSymbol]) {
      return symbolDirectory[normalizedSymbol];
    }

    const directResult = await fetchSymbols({ symbols: normalizedSymbol, limit: 1 });
    if (directResult.symbols.length) {
      return directResult.symbols[0];
    }

    const searchResults = await lookupSymbols(normalizedSymbol, { limit: 5 });
    return (
      searchResults.find((item) => item.symbol === normalizedSymbol || item.baseSymbol === normalizedSymbol) ||
      searchResults[0] ||
      null
    );
  }, [fetchSymbols, lookupSymbols, symbolDirectory, upsertSymbols]);

  const applyQuote = useCallback((quote) => {
    if (!quote?.symbol) {
      return;
    }

    const previousQuote = marketQuotesRef.current[quote.symbol];
    const normalizedQuote = {
      ...quote,
      price: Number(quote.price || 0),
      change: Number(quote.change || 0),
      volume: Number(quote.volume || 0),
      previousClose: Number(quote.previousClose || 0)
    };

    // Keep the current UI state when a transient provider failure produces a zero quote.
    if (normalizedQuote.error && !normalizedQuote.price && previousQuote?.price) {
      return;
    }

    setMarketQuotes((current) => {
      const next = {
        ...current,
        [quote.symbol]: normalizedQuote
      };
      marketQuotesRef.current = next;
      return next;
    });

    if (normalizedQuote.price) {
      setPositions((currentPositions) => {
        let changed = false;
        const updated = currentPositions.map((pos) => {
          if (pos.symbol === quote.symbol) {
            changed = true;
            const livePrice = normalizedQuote.price;
            const marketValue = pos.quantity * livePrice;
            const costBasis = pos.invested ?? (pos.quantity * (pos.avgPrice || pos.averagePrice || 0));
            return {
              ...pos,
              marketPrice: livePrice,
              marketValue,
              unrealizedPnl: marketValue - costBasis
            };
          }
          return pos;
        });
        return changed ? updated : currentPositions;
      });
    }

    if (selectedSymbolRef.current === quote.symbol) {
      const percent = normalizedQuote.previousClose
        ? (normalizedQuote.change / normalizedQuote.previousClose) * 100
        : priceChangeRef.current.percent;

      const nextPriceChange = {
        value: normalizedQuote.change || 0,
        percent: Number.isFinite(percent) ? percent : 0
      };
      priceChangeRef.current = nextPriceChange;
      setPriceChange(nextPriceChange);

      setAssetInfo((current) => ({
        ...(current || {}),
        currentPrice: normalizedQuote.price || current?.currentPrice || 0,
        volume: normalizedQuote.volume || current?.volume || 0
      }));

      setTradePrice((current) => current || String(normalizedQuote.price || ''));
      setChartData((current) => {
        if (!current.length || !normalizedQuote.price) {
          return current;
        }

        const lastIndex = current.length - 1;
        const lastCandle = current[lastIndex];
        if (!lastCandle) {
          return current;
        }

        const nextLastCandle = {
          ...lastCandle,
          close: normalizedQuote.price,
          high: Math.max(Number(lastCandle.high || 0), normalizedQuote.price),
          low: lastCandle.low ? Math.min(Number(lastCandle.low || normalizedQuote.price), normalizedQuote.price) : normalizedQuote.price,
          volume: normalizedQuote.volume || lastCandle.volume || 0
        };

        if (
          nextLastCandle.close === lastCandle.close &&
          nextLastCandle.high === lastCandle.high &&
          nextLastCandle.low === lastCandle.low &&
          nextLastCandle.volume === lastCandle.volume
        ) {
          return current;
        }

        const next = current.slice();
        next[lastIndex] = nextLastCandle;
        return next;
      });
    }
  }, []);

  const fetchUser = useCallback(async () => {
    if (!activeUserId) {
      setUser(null);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/users/${activeUserId}`);
      setUser(response.data);
    } catch (error) {
      logApiFailure('fetch user', error);
    }
  }, [activeUserId]);

  const fetchPortfolio = useCallback(async () => {
    if (!activeUserId) {
      setPortfolio(null);
      setOrders([]);
      setPositions([]);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/portfolio/${activeUserId}`);
      const nextPortfolio = response.data;
      setPortfolio(nextPortfolio);

      if (nextPortfolio?.user) {
        setUser({
          id: nextPortfolio.user.id,
          balance: nextPortfolio.user.balance,
          positions: {}
        });
      }

      if (Array.isArray(nextPortfolio?.orders)) {
        setOrders(nextPortfolio.orders);
      }

      if (Array.isArray(nextPortfolio?.trades)) {
        setRecentTrades(nextPortfolio.trades);
      }

      if (Array.isArray(nextPortfolio?.positions) && nextPortfolio.positions.length > 0) {
        const currentOrders = Array.isArray(nextPortfolio?.orders) ? nextPortfolio.orders : [];
        setPositions(nextPortfolio.positions.map((position) => {
          const quantity = Number(position.quantity || 0);
          let avgPrice = Number(position.averagePrice ?? position.avgPrice ?? 0);
          let invested = Number(position.invested ?? 0);

          if ((!avgPrice || avgPrice <= 0) && quantity > 0) {
            const buyOrders = currentOrders.filter(
              (o) => o.symbol === position.symbol && o.side === 'BUY' && Number(o.filled_qty || 0) > 0
            );
            if (buyOrders.length > 0) {
              const totalCost = buyOrders.reduce((sum, o) => sum + Number(o.filled_qty) * Number(o.avg_fill_price || o.price || 0), 0);
              const totalQty = buyOrders.reduce((sum, o) => sum + Number(o.filled_qty), 0);
              if (totalQty > 0) {
                avgPrice = totalCost / totalQty;
                invested = quantity * avgPrice;
              }
            }
          }

          if (invested <= 0 && avgPrice > 0 && quantity > 0) {
            invested = quantity * avgPrice;
          }

          const hasCostBasis = avgPrice > 0 && invested > 0;
          const livePrice = Number(marketQuotes[position.symbol]?.price || position.marketPrice || (hasCostBasis ? avgPrice : 0));
          const marketValue = quantity * livePrice;
          const unrealizedPnl = hasCostBasis ? marketValue - invested : null;

          return {
            symbol: position.symbol,
            assetType: position.assetType,
            quantity,
            avgPrice: hasCostBasis ? avgPrice : null,
            averagePrice: hasCostBasis ? avgPrice : null,
            invested: hasCostBasis ? invested : null,
            marketPrice: livePrice,
            marketValue,
            unrealizedPnl,
            costBasisKnown: hasCostBasis
          };
        }));
      } else {
        setPositions(buildPositionsFromOrders(nextPortfolio?.orders || [], marketQuotes));
      }
    } catch (error) {
      logApiFailure('fetch portfolio', error);
    }
  }, [activeUserId, marketQuotes]);

  const fetchPositions = useCallback(async () => {
    if (!activeUserId) {
      setOrders([]);
      setPositions([]);
      return;
    }

    try {
      const [positionsResponse, ordersResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/positions/${activeUserId}`),
        axios.get(`${API_BASE_URL}/api/users/${activeUserId}/orders`)
      ]);

      const nextOrders = ordersResponse.data.orders || [];
      setOrders(nextOrders);

      const nextPositions = positionsResponse.data.positions?.length
        ? positionsResponse.data.positions.map((position) => {
            const quantity = Number(position.quantity || 0);
            let avgPrice = Number(position.averagePrice ?? position.avgPrice ?? 0);
            let invested = Number(position.invested ?? 0);

            if ((!avgPrice || avgPrice <= 0) && quantity > 0) {
              const buyOrders = nextOrders.filter(
                (o) => o.symbol === position.symbol && o.side === 'BUY' && Number(o.filled_qty || 0) > 0
              );
              if (buyOrders.length > 0) {
                const totalCost = buyOrders.reduce((sum, o) => sum + Number(o.filled_qty) * Number(o.avg_fill_price || o.price || 0), 0);
                const totalQty = buyOrders.reduce((sum, o) => sum + Number(o.filled_qty), 0);
                if (totalQty > 0) {
                  avgPrice = totalCost / totalQty;
                  invested = quantity * avgPrice;
                }
              }
            }

            if (invested <= 0 && avgPrice > 0 && quantity > 0) {
              invested = quantity * avgPrice;
            }

            const hasCostBasis = avgPrice > 0 && invested > 0;
            const livePrice = Number(marketQuotes[position.symbol]?.price || position.marketPrice || (hasCostBasis ? avgPrice : 0));
            const marketValue = quantity * livePrice;
            const unrealizedPnl = hasCostBasis ? marketValue - invested : null;

            return {
              symbol: position.symbol,
              assetType: position.assetType,
              quantity,
              avgPrice: hasCostBasis ? avgPrice : null,
              averagePrice: hasCostBasis ? avgPrice : null,
              invested: hasCostBasis ? invested : null,
              marketPrice: livePrice,
              marketValue,
              unrealizedPnl,
              costBasisKnown: hasCostBasis
            };
          })
        : buildPositionsFromOrders(nextOrders, marketQuotes);

      setPositions(nextPositions);
    } catch (error) {
      logApiFailure('fetch positions', error);
    }
  }, [activeUserId, marketQuotes]);

  const fetchNotifications = useCallback(async () => {
    if (!activeUserId) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/notifications`);
      const notifs = response.data.notifications || [];
      setNotifications(notifs);
      setUnreadNotificationCount(response.data.unreadCount ?? notifs.filter((n) => !n.read).length);
    } catch (error) {
      logApiFailure('fetch notifications', error);
      setNotificationsError('Unable to sync live notifications with the server.');
    } finally {
      setNotificationsLoading(false);
    }
  }, [activeUserId]);

  const markNotificationRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    try {
      await axios.put(`${API_BASE_URL}/api/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logApiFailure(`mark notification read ${notificationId}`, error);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/notifications/mark-all-read`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotificationCount(0);
    } catch (error) {
      logApiFailure('mark all notifications read', error);
    }
  }, []);

  const fetchOrderBook = useCallback(async (symbol = selectedAsset?.symbol) => {
    if (!symbol) {
      return;
    }

    setOrderBookLoading(true);
    setOrderBookError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orderbook/${symbol}`);
      const data = response.data || {};
      if (data.error) {
        setOrderBookError(data.error);
      }
      setOrderBook({
        symbol,
        bids: data.bids || [],
        asks: data.asks || []
      });
      setOrderBookLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (error) {
      logApiFailure(`fetch order book for ${symbol}`, error);
      const errMsg = error.response?.data?.error || error.message || 'Failed to fetch order book';
      setOrderBookError(errMsg);
      setOrderBook({ symbol, bids: [], asks: [] });
    } finally {
      setOrderBookLoading(false);
    }
  }, [selectedAsset]);

  const fetchRecentTrades = useCallback(async () => {
    if (!activeUserId) {
      setRecentTrades([]);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/users/${activeUserId}/trades`);
      setRecentTrades(response.data.trades || []);
    } catch (error) {
      logApiFailure('fetch recent trades', error);
      setRecentTrades([]);
    }
  }, [activeUserId]);

  const fetchQuote = useCallback(async (symbol, resolvedAssetType) => {
    if (!symbol) {
      return null;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/market/quote/${symbol}`, {
        params: { assetType: resolvedAssetType || inferAssetType(symbol) }
      });
      applyQuote(response.data);
      return response.data;
    } catch (error) {
      logApiFailure(`fetch quote for ${symbol}`, error);
      return null;
    }
  }, [applyQuote]);

  const fetchAssetData = useCallback(async (symbol, resolvedAssetType, interval = chartInterval, range = chartRange) => {
    if (!symbol) {
      return [];
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/market/candles/${symbol}`, {
        params: {
          assetType: resolvedAssetType || inferAssetType(symbol),
          interval,
          range
        }
      });

      const candles = response.data.candles || [];
      setChartData((current) => {
        if (
          current.length === candles.length &&
          current.at(-1)?.time === candles.at(-1)?.time &&
          current.at(-1)?.close === candles.at(-1)?.close &&
          current[0]?.time === candles[0]?.time
        ) {
          return current;
        }

        return candles;
      });

      if (candles.length >= 2) {
        const last = candles[candles.length - 1];
        const previous = candles[candles.length - 2];
        const liveQuote = marketQuotesRef.current[symbol];
        const currentPrice = liveQuote?.price || last.close;
        const change = liveQuote?.change ?? (last.close - previous.close);
        const percent = liveQuote?.previousClose
          ? (change / liveQuote.previousClose) * 100
          : (previous.close ? (change / previous.close) * 100 : 0);
        const nextPriceChange = { value: change, percent };

        priceChangeRef.current = nextPriceChange;
        setPriceChange(nextPriceChange);
        setAssetInfo({
          currentPrice,
          dayHigh: Math.max(...candles.slice(-20).map((entry) => entry.high)),
          dayLow: Math.min(...candles.slice(-20).map((entry) => entry.low)),
          volume: liveQuote?.volume || last.volume,
          marketCap: currentPrice * 1000000
        });
      }

      return candles;
    } catch (error) {
      logApiFailure(`fetch candles for ${symbol}`, error);
    }

    try {
      const fallbackResponse = await axios.get(`${API_BASE_URL}/api/data/${symbol}`, {
        params: { days: range === '1d' ? 1 : range === '5d' ? 5 : 30 }
      });
      const fallbackCandles = fallbackResponse.data.data || [];
      setChartData(fallbackCandles);
      return fallbackCandles;
    } catch (fallbackError) {
      logApiFailure(`fetch fallback candles for ${symbol}`, fallbackError);
      return [];
    }
  }, [chartInterval, chartRange]);

  const refreshMarketData = useCallback(async ({ silent = false } = {}) => {
    const activeSelection = latestSelectionRef.current;
    if (!activeSelection?.symbol) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      await Promise.all([
        fetchQuote(activeSelection.symbol, activeSelection.assetType || assetType),
        fetchAssetData(activeSelection.symbol, activeSelection.assetType || assetType),
        fetchOrderBook(activeSelection.symbol)
      ]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [assetType, fetchAssetData, fetchOrderBook, fetchQuote]);

  const selectAsset = useCallback(async (assetOrSymbol) => {
    const asset = await resolveAsset(assetOrSymbol);
    if (!asset?.symbol) {
      return;
    }

    const resolvedAssetType = asset.assetType || inferAssetType(asset.symbol);
    latestSelectionRef.current = {
      symbol: asset.symbol,
      assetType: resolvedAssetType
    };
    setSelectedAsset(asset);
    setAssetType(resolvedAssetType);
    setTradePrice(String(marketQuotes[asset.symbol]?.price || asset.price || ''));
    setPrediction(null);
    setSuggestion(null);
    setLoading(true);
    await Promise.all([
      fetchQuote(asset.symbol, resolvedAssetType),
      fetchAssetData(asset.symbol, resolvedAssetType),
      fetchOrderBook(asset.symbol)
    ]);
    setLoading(false);
  }, [fetchAssetData, fetchOrderBook, fetchQuote, marketQuotes, resolveAsset]);

  const persistWatchlist = useCallback(async (symbols) => {
    if (!activeUserId) {
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/api/market/watchlist/${activeUserId}`, {
        symbols: symbols.map((symbol) => ({
          symbol,
          assetType: inferAssetType(symbol)
        }))
      });
    } catch (error) {
      logApiFailure('persist watchlist', error);
    }
  }, [activeUserId]);

  const removeWatchlistSymbol = useCallback((symbol) => {
    setWatchlist((current) => {
      const next = current.filter((item) => item !== symbol);
      persistWatchlist(next);
      return next;
    });
  }, [persistWatchlist]);

  const addSymbolToWatchlist = useCallback(async (symbolOrAsset) => {
    const asset = await resolveAsset(symbolOrAsset);
    const normalizedSymbol = asset?.symbol;

    if (!normalizedSymbol || watchlist.includes(normalizedSymbol)) {
      return;
    }

    const next = [...watchlist, normalizedSymbol];
    setWatchlist(next);
    await persistWatchlist(next);
    await fetchQuote(normalizedSymbol, asset.assetType || inferAssetType(normalizedSymbol));
  }, [fetchQuote, persistWatchlist, resolveAsset, watchlist]);

  const addToWatchlist = useCallback(async (symbolOrAsset = watchlistInput) => {
    await addSymbolToWatchlist(symbolOrAsset);
    setWatchlistInput('');
  }, [addSymbolToWatchlist, watchlistInput]);

  const fetchWatchlist = useCallback(async () => {
    if (!activeUserId) {
      setWatchlist(DEFAULT_WATCHLIST);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/market/watchlist/${activeUserId}`);
      const nextWatchlist = normalizeWatchlistSymbols(response.data.symbols);
      const effectiveWatchlist = nextWatchlist.length ? nextWatchlist : DEFAULT_WATCHLIST;
      setWatchlist(effectiveWatchlist);

      const symbolResponse = await fetchSymbols({
        symbols: effectiveWatchlist.join(','),
        limit: effectiveWatchlist.length
      });

      if (Array.isArray(response.data.quotes)) {
        response.data.quotes.forEach(applyQuote);
      }

      if (!selectedAsset?.symbol && symbolResponse.symbols.length) {
        latestSelectionRef.current = {
          symbol: symbolResponse.symbols[0].symbol,
          assetType: symbolResponse.symbols[0].assetType || inferAssetType(symbolResponse.symbols[0].symbol)
        };
        setSelectedAsset(symbolResponse.symbols[0]);
        setAssetType(symbolResponse.symbols[0].assetType || inferAssetType(symbolResponse.symbols[0].symbol));
        setTradePrice(String(symbolResponse.symbols[0].price || ''));
      }
    } catch (error) {
      logApiFailure('fetch watchlist', error);
    }
  }, [activeUserId, applyQuote, fetchSymbols, selectedAsset]);

  useEffect(() => {
    if (!activeUserId) {
      setUser(null);
      setPortfolio(null);
      setPositions([]);
      setOrders([]);
      setRecentTrades([]);
      setNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }

    fetchUser();
    fetchPortfolio();
    fetchPositions();
    fetchWatchlist();
    fetchRecentTrades();
    fetchNotifications();
  }, [activeUserId, fetchNotifications, fetchPortfolio, fetchPositions, fetchRecentTrades, fetchUser, fetchWatchlist]);

  useEffect(() => {
    selectedSymbolRef.current = selectedAsset?.symbol || null;
  }, [selectedAsset?.symbol]);

  useEffect(() => {
    if (!selectedAsset?.symbol) {
      return;
    }

    latestSelectionRef.current = {
      symbol: selectedAsset.symbol,
      assetType
    };
    refreshMarketData();
  }, [assetType, chartInterval, chartRange, refreshMarketData, selectedAsset?.symbol]);

  useEffect(() => {
    if (!streamedSymbols.length) {
      return undefined;
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const socket = new window.WebSocket(
      `${wsBase}/ws/market?symbols=${encodeURIComponent(streamedSymbols.join(','))}`
    );
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'market_quotes' && Array.isArray(payload.data)) {
          payload.data.forEach(applyQuote);
        }
      } catch (error) {
        logApiFailure('parse market stream payload', error);
      }
    };

    socket.onerror = () => {};

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [applyQuote, streamedSymbols]);

  useEffect(() => {
    if (!activeUserId) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      fetchPortfolio();
      fetchPositions();
      fetchOrderBook();
      fetchRecentTrades();
      if (latestSelectionRef.current?.symbol) {
        fetchAssetData(
          latestSelectionRef.current.symbol,
          latestSelectionRef.current.assetType || assetType
        );
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeUserId, assetType, fetchAssetData, fetchOrderBook, fetchPortfolio, fetchPositions, fetchRecentTrades]);

  const analyzeAsset = async (targetAsset = null) => {
    const assetToAnalyze = targetAsset || selectedAsset;
    if (!assetToAnalyze) {
      return;
    }

    if (targetAsset && targetAsset.symbol !== selectedAsset?.symbol) {
      setSelectedAsset(targetAsset);
    }

    setAnalyzing(true);
    setPrediction(null);
    setSuggestion(null);

    try {
      let predictResponse;
      try {
        predictResponse = await axios.post(`${API_BASE_URL}/api/predict`, {
          symbol: assetToAnalyze.symbol
        });
      } catch (apiErr) {
        // Fallback to /predict if /api/predict fails
        predictResponse = await axios.post(`${API_BASE_URL}/predict`, {
          symbol: assetToAnalyze.symbol
        });
      }

      const predictionData = predictResponse.data;
      setPrediction(predictionData);

      if (predictionData && predictionData.status !== 'unavailable' && predictionData.supported !== false) {
        const suggestResponse = await axios.post(`${API_BASE_URL}/suggest`, {
          symbol: assetToAnalyze.symbol,
          prediction: predictionData,
          currentPosition: positions.find((position) => position.symbol === assetToAnalyze.symbol)?.quantity || 0
        });
        setSuggestion(suggestResponse.data);
      } else {
        setSuggestion(null);
      }
    } catch (error) {
      logApiFailure(`analyze ${assetToAnalyze.symbol}`, error);
      setPrediction({
        symbol: assetToAnalyze.symbol,
        status: 'error',
        message: error?.response?.data?.error || error?.message || 'Unable to generate prediction'
      });
      setSuggestion(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const refreshAfterOrder = useCallback(async (symbol = selectedAsset?.symbol) => {
    await Promise.all([
      fetchUser(),
      fetchPortfolio(),
      fetchPositions(),
      fetchRecentTrades(),
      fetchNotifications(),
      symbol ? fetchOrderBook(symbol) : Promise.resolve()
    ]);
  }, [fetchNotifications, fetchOrderBook, fetchPortfolio, fetchPositions, fetchRecentTrades, fetchUser, selectedAsset?.symbol]);

  const handlePlaceOrder = async (side) => {
    if (!selectedAsset || isSubmittingOrder) {
      return;
    }

    const resolvedSide = side.toUpperCase();
    const qty = parseInt(tradeQuantity, 10);
    if (!qty || qty <= 0) {
      flashTradeMessage({
        type: 'error',
        message: 'Order quantity must be a positive integer.'
      });
      return;
    }

    const resolvedPrice = orderType === 'MARKET'
      ? assetInfo?.currentPrice || marketQuotes[selectedAsset.symbol]?.price
      : parseFloat(tradePrice);

    if (orderType === 'MARKET' && (!resolvedPrice || resolvedPrice <= 0)) {
      flashTradeMessage({
        type: 'error',
        message: 'Market quote unavailable. Wait for real-time market price before placing a market order.'
      });
      return;
    }

    if (orderType === 'LIMIT' && (!resolvedPrice || resolvedPrice <= 0 || isNaN(resolvedPrice))) {
      flashTradeMessage({
        type: 'error',
        message: 'Please specify a valid limit price greater than ₹0.'
      });
      return;
    }

    try {
      setIsSubmittingOrder(true);
      const response = await axios.post(`${API_BASE_URL}/api/orders`, {
        symbol: selectedAsset.symbol,
        side: resolvedSide,
        type: orderType,
        price: resolvedPrice,
        quantity: qty
      });

      const data = response.data || {};
      const order = data.order || {};

      if (data.success === false || order.status === 'CANCELLED') {
        flashTradeMessage({
          type: 'warning',
          message: data.message || 'Market order cancelled: No counterparty liquidity available in the order book.'
        });
      } else if (order.status === 'PARTIALLY_FILLED') {
        flashTradeMessage({
          type: 'info',
          message: `Order partially filled: ${order.filled_qty}/${order.quantity} units executed @ ₹${Number(order.avg_fill_price || resolvedPrice).toFixed(2)}. Remaining ${order.remaining_qty} units resting in book.`
        });
      } else if (order.status === 'FILLED') {
        flashTradeMessage({
          type: 'success',
          message: `Order filled: ${order.quantity} units ${order.side} ${order.symbol} executed @ ₹${Number(order.avg_fill_price || resolvedPrice).toFixed(2)}.`
        });
      } else if (order.status === 'OPEN') {
        flashTradeMessage({
          type: 'info',
          message: `Resting limit order placed: ${order.quantity} units ${order.side} ${order.symbol} @ ₹${Number(order.price || resolvedPrice).toFixed(2)}.`
        });
      } else {
        flashTradeMessage({
          type: 'info',
          message: `${resolvedSide} order submitted (${order.status || 'SUBMITTED'}). Order ID: ${order.id || ''}`
        });
      }

      await refreshAfterOrder(selectedAsset.symbol);
    } catch (error) {
      logApiFailure(`place ${side} order for ${selectedAsset.symbol}`, error);
      flashTradeMessage({
        type: 'error',
        message: error.response?.data?.error || error.message || 'Failed to place order'
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cancelOrder = useCallback(async (order) => {
    if (!order?.id || !order?.symbol) {
      return;
    }
    if (cancellingOrderId === order.id) {
      return;
    }

    try {
      setCancellingOrderId(order.id);
      const response = await axios.post(`${API_BASE_URL}/api/orders/${order.id}/cancel`, {
        symbol: order.symbol
      });
      flashTradeMessage({
        type: 'info',
        message: response.data.message || `Order ${order.id} cancelled`
      });
      await refreshAfterOrder(order.symbol);
    } catch (error) {
      logApiFailure(`cancel order ${order.id}`, error);
      flashTradeMessage({
        type: 'error',
        message: error.response?.data?.error || 'Cancel failed'
      });
    } finally {
      setCancellingOrderId(null);
    }
  }, [cancellingOrderId, refreshAfterOrder]);

  const getTotalPortfolioValue = useCallback(() => {
    if (portfolio?.summary?.totalPortfolioValue) {
      return portfolio.summary.totalPortfolioValue;
    }

    if (!user) {
      return 0;
    }

    const positionValue = positions.reduce((sum, position) => {
      const livePrice = marketQuotes[position.symbol]?.price || position.marketPrice || position.avgPrice;
      return sum + position.quantity * livePrice;
    }, 0);

    return user.balance + positionValue;
  }, [marketQuotes, portfolio, positions, user]);

  const watchlistDetails = useMemo(() => {
    return watchlist.map((symbol) => {
      const asset = symbolDirectory[symbol] || {
        symbol,
        name: symbol,
        assetType: inferAssetType(symbol)
      };
      const quote = marketQuotes[symbol];
      return {
        ...asset,
        livePrice: quote?.price ?? asset.price ?? 0,
        change: quote?.change ?? 0,
        changePercent: quote?.previousClose ? (quote.change / quote.previousClose) * 100 : 0,
        volume: quote?.volume ?? 0
      };
    });
  }, [marketQuotes, symbolDirectory, watchlist]);

  return {
    activeDockTab,
    addToWatchlist,
    addSymbolToWatchlist,
    assetInfo,
    assetType,
    analyzeAsset,
    analyzing,
    cancelOrder,
    chartData,
    chartInterval,
    chartRange,
    fetchOrderBook,
    fetchPortfolio,
    fetchPositions,
    fetchRecentTrades,
    fetchSymbols,
    getTotalPortfolioValue,
    handlePlaceOrder,
    loading,
    lookupSymbols,
    marketQuotes,
    orderBook,
    orderBookLoading,
    orderBookError,
    orderBookLastUpdated,
    isSubmittingOrder,
    cancellingOrderId,
    orders,
    orderType,
    persistWatchlist,
    portfolio,
    positions,
    prediction,
    priceChange,
    recentTrades,
    refreshMarketData,
    removeWatchlistSymbol,
    resolveAsset,
    selectAsset,
    selectedAsset,
    setActiveDockTab,
    setAssetType,
    setChartInterval,
    setChartRange,
    setOrderType,
    setTradeMode,
    setTradePrice,
    setTradeQuantity,
    setWatchlist,
    setWatchlistInput,
    suggestion,
    symbolDirectory,
    tradeMode,
    tradePrice,
    tradeQuantity,
    tradeSuccess,
    user,
    watchlist,
    watchlistDetails,
    watchlistInput,
    notifications,
    unreadNotificationCount,
    notificationsLoading,
    notificationsError,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead
  };
}
