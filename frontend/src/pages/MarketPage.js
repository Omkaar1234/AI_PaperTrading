import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import MarketHeader from '../components/markets/MarketHeader';
import MarketHeatmap from '../components/markets/MarketHeatmap';
import MarketSearchBar from '../components/markets/MarketSearchBar';
import MarketTable from '../components/markets/MarketTable';
import QuickPreview from '../components/markets/QuickPreview';
import SectorFilter from '../components/markets/SectorFilter';
import StockCard from '../components/markets/StockCard';
import TopMovers from '../components/markets/TopMovers';
import Watchlist from '../components/markets/Watchlist';
import {
  getMarketCapBucket,
  getStockSearchText,
  INDIAN_FALLBACK_STOCKS,
  isIndianListedStock,
  normalizeIndianStock
} from '../components/markets/marketUtils';

const SORT_MAP = {
  Company: 'name',
  'NSE Symbol': 'symbol',
  Price: 'price',
  Change: 'change',
  '%': 'changePercent',
  Volume: 'volume',
  'Market Cap': 'marketCap'
};

function MarketPage({ trading }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    cap: 'all',
    sector: 'All Sectors',
    change: 'all',
    sort: 'name'
  });
  const [localPage, setLocalPage] = useState(1);
  const [page, setPage] = useState(1);
  const [marketRows, setMarketRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0, hasNextPage: false });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sortKey, setSortKey] = useState('name');

  useEffect(() => {
    let ignore = false;

    const fetchMarket = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/market`, {
          params: {
            q: query || undefined,
            page,
            limit: 50,
            type: 'stock',
            exchange: 'NSE',
            marketCapCategory: filters.cap === 'all' ? undefined : filters.cap
          }
        });

        const apiRows = response.data.market || response.data.symbols || [];
        if (!ignore) {
          const rows = apiRows
            .filter(isIndianListedStock)
            .map(normalizeIndianStock);
          const effectiveRows = rows.length ? rows : INDIAN_FALLBACK_STOCKS.map(normalizeIndianStock);
          setMarketRows(effectiveRows);
          setPagination(response.data.pagination || { page: 1, totalPages: 1, total: effectiveRows.length, hasNextPage: false });
          setSelectedStock((current) => current && effectiveRows.some((row) => row.symbol === current.symbol) ? current : effectiveRows[0] || null);
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (!ignore) {
          const fallbackRows = INDIAN_FALLBACK_STOCKS.map(normalizeIndianStock);
          setMarketRows(fallbackRows);
          setPagination({ page: 1, totalPages: 1, total: fallbackRows.length, hasNextPage: false });
          setSelectedStock((current) => current || fallbackRows[0] || null);
          setLastUpdated(new Date());
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchMarket();
    return () => {
      ignore = true;
    };
  }, [filters.cap, page, query]);

  useEffect(() => {
    setPage(1);
    setLocalPage(1);
  }, [filters.cap, filters.change, filters.sector, filters.sort, query]);

  const watchedSymbols = useMemo(
    () => new Set((trading.watchlistDetails || []).map((asset) => asset.symbol)),
    [trading.watchlistDetails]
  );

  const filteredStocks = useMemo(() => {
    let rows = marketRows.filter((stock) => {
      const needle = query.trim().toLowerCase();
      if (needle && !getStockSearchText(stock).includes(needle)) {
        return false;
      }
      if (filters.cap !== 'all' && getMarketCapBucket(stock) !== filters.cap) {
        return false;
      }
      if (filters.sector !== 'All Sectors' && stock.sector !== filters.sector) {
        return false;
      }
      if (filters.change === 'gainers' && stock.changePercent < 0) {
        return false;
      }
      if (filters.change === 'losers' && stock.changePercent >= 0) {
        return false;
      }
      return true;
    });

    if (filters.change === 'active') {
      rows = [...rows].sort((a, b) => b.volume - a.volume);
    } else {
      rows = [...rows].sort((a, b) => {
        const key = sortKey || filters.sort;
        if (key === 'name' || key === 'symbol') {
          return String(a[key] || '').localeCompare(String(b[key] || ''));
        }
        return Number(b[key] || 0) - Number(a[key] || 0);
      });
    }

    return rows;
  }, [filters.cap, filters.change, filters.sector, filters.sort, marketRows, query, sortKey]);

  const visibleStocks = useMemo(() => {
    const pageSize = 18;
    const start = (localPage - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, localPage]);

  const localTotalPages = Math.max(1, Math.ceil(filteredStocks.length / 18));

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return marketRows.filter((stock) => getStockSearchText(stock).includes(needle));
  }, [marketRows, query]);

  const handleSort = (label) => {
    const nextSort = SORT_MAP[label] || filters.sort;
    setSortKey(nextSort);
    setFilters((current) => ({ ...current, sort: nextSort }));
  };

  const [mobileTab, setMobileTab] = useState('explore');

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
  };

  return (
    <div className="page markets-page">
      <MarketHeader totalStocks={pagination.total || filteredStocks.length} lastUpdated={lastUpdated} />

      {/* Mobile-only view tab switcher for screens < 768px */}
      <div className="markets-mobile-nav" role="tablist" aria-label="Markets view switch">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'explore'}
          className={`markets-mobile-tab ${mobileTab === 'explore' ? 'active' : ''}`}
          onClick={() => setMobileTab('explore')}
        >
          All Stocks & Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'watchlist'}
          className={`markets-mobile-tab ${mobileTab === 'watchlist' ? 'active' : ''}`}
          onClick={() => setMobileTab('watchlist')}
        >
          Watchlist & Heatmap
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'preview'}
          className={`markets-mobile-tab ${mobileTab === 'preview' ? 'active' : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          {selectedStock ? selectedStock.symbol : 'Stock Details'}
        </button>
      </div>

      <div className="markets-discovery-layout">
        <div className={`markets-left-rail ${mobileTab === 'watchlist' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <Watchlist trading={trading} onSelectStock={handleSelectStock} />
          <MarketHeatmap stocks={filteredStocks} />
        </div>

        <div className={`markets-center-stage ${mobileTab === 'explore' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <MarketSearchBar
            query={query}
            onQueryChange={setQuery}
            suggestions={suggestions}
            onSelectSuggestion={(stock) => {
              setSelectedStock(stock);
              setQuery(stock.symbol);
            }}
          />

          <SectorFilter filters={filters} onFiltersChange={setFilters} />

          <div className="markets-stock-strip">
            {filteredStocks.slice(0, 6).map((stock) => (
              <StockCard key={stock.symbol} stock={stock} active={selectedStock?.symbol === stock.symbol} onClick={handleSelectStock} />
            ))}
          </div>

          <MarketTable
            rows={visibleStocks}
            loading={loading}
            watchedSymbols={watchedSymbols}
            onSort={handleSort}
            sortKey={Object.entries(SORT_MAP).find(([, value]) => value === sortKey)?.[0]}
            onSelectStock={handleSelectStock}
            onWatch={(stock) => trading.addSymbolToWatchlist(stock)}
            trading={trading}
          />

          <div className="pagination-row markets-pagination">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (localPage > 1) {
                  setLocalPage((current) => current - 1);
                } else if (page > 1) {
                  setPage((current) => current - 1);
                  setLocalPage(1);
                }
              }}
              disabled={localPage <= 1 && page <= 1}
            >
              Previous
            </button>
            <span className="pagination-info tabular-nums">
              Page {localPage} of {localTotalPages} · {filteredStocks.length.toLocaleString('en-IN')} stocks
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (localPage < localTotalPages) {
                  setLocalPage((current) => current + 1);
                } else if (pagination.hasNextPage) {
                  setPage((current) => current + 1);
                  setLocalPage(1);
                }
              }}
              disabled={localPage >= localTotalPages && !pagination.hasNextPage}
            >
              Next
            </button>
          </div>

          <TopMovers stocks={filteredStocks} />
        </div>

        <div className={`markets-preview-rail ${mobileTab === 'preview' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <QuickPreview stock={selectedStock} trading={trading} />
        </div>
      </div>
    </div>
  );
}

export default MarketPage;
