import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, ASSET_TYPES, formatAssetPrice } from '../constants';

const TYPE_OPTIONS = [
  { label: 'All Markets', value: 'all' },
  { label: 'NSE Stocks', value: 'stock' },
  { label: 'Crypto', value: 'crypto' }
];

const CAP_OPTIONS = [
  { label: 'All Caps', value: 'all' },
  { label: 'Large Cap', value: 'large cap' },
  { label: 'Mid Cap', value: 'mid cap' },
  { label: 'Small Cap', value: 'small cap' }
];

function MarketPage({ trading }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState('stock');
  const [capFilter, setCapFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [marketRows, setMarketRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0, hasNextPage: false });
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const watchedSymbols = useMemo(
    () => new Set(trading.watchlistDetails.map((asset) => asset.symbol)),
    [trading.watchlistDetails]
  );

  useEffect(() => {
    let ignore = false;

    const fetchMarket = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/market`, {
          params: {
            q: query || undefined,
            page,
            limit: 25,
            type: assetFilter === 'all' ? undefined : assetFilter,
            exchange: assetFilter === 'stock' ? 'NSE' : undefined,
            marketCapCategory:
              assetFilter === 'stock' && capFilter !== 'all' ? capFilter : undefined
          }
        });

        if (!ignore) {
          setMarketRows(response.data.market || []);
          setPagination(response.data.pagination || { page: 1, totalPages: 0, total: 0, hasNextPage: false });
        }
      } catch (error) {
        if (!ignore) {
          setMarketRows([]);
          setPagination({ page: 1, totalPages: 0, total: 0, hasNextPage: false });
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
  }, [assetFilter, capFilter, page, query]);

  useEffect(() => {
    let ignore = false;

    const fetchSearch = async () => {
      const trimmed = trading.watchlistInput.trim();
      if (!trimmed) {
        setSearchResults([]);
        return;
      }

      try {
        const results = await trading.lookupSymbols(trimmed, {
          limit: 6,
          type: assetFilter === 'all' ? undefined : assetFilter,
          exchange: assetFilter === 'stock' ? 'NSE' : undefined
        });
        if (!ignore) {
          setSearchResults(results);
        }
      } catch (error) {
        if (!ignore) {
          setSearchResults([]);
        }
      }
    };

    fetchSearch();
    return () => {
      ignore = true;
    };
  }, [assetFilter, trading, trading.watchlistInput]);

  useEffect(() => {
    setPage(1);
  }, [assetFilter, capFilter, query]);

  return (
    <div className="page market-page">
      <section className="card market-toolbar">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Symbol universe</p>
            <h3>Market Scanner</h3>
          </div>
          <div className="market-count">{pagination.total || 0} symbols</div>
        </div>

        <div className="market-controls">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Reliance, TCS, BTC, ETH"
          />
          <div className="segment-control market-filter-segments">
            {TYPE_OPTIONS.map((filter) => (
              <button
                key={filter.value}
                className={assetFilter === filter.value ? 'active' : ''}
                onClick={() => setAssetFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {assetFilter !== 'crypto' ? (
            <div className="segment-control market-filter-segments">
              {CAP_OPTIONS.map((filter) => (
                <button
                  key={filter.value}
                  className={capFilter === filter.value ? 'active' : ''}
                  onClick={() => setCapFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="market-content-grid">
        <section className="card market-watchlist-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">User watchlist</p>
              <h3>Tracked Symbols</h3>
            </div>
          </div>

          <div className="watchlist-composer">
            <input
              type="text"
              placeholder="Search and add symbols"
              value={trading.watchlistInput}
              onChange={(event) => trading.setWatchlistInput(event.target.value)}
            />
            <button className="secondary-button" onClick={() => trading.addToWatchlist()}>
              Add
            </button>
          </div>

          {searchResults.length ? (
            <div className="symbol-search-dropdown">
              {searchResults.map((asset) => (
                <button
                  key={asset.symbol}
                  className="symbol-search-item"
                  onClick={() => trading.addToWatchlist(asset)}
                >
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="watchlist market-watchlist">
            {trading.watchlistDetails.length ? (
              trading.watchlistDetails.map((asset) => (
                <button
                  key={asset.symbol}
                  className={`watchlist-quote ${trading.selectedAsset?.symbol === asset.symbol ? 'active' : ''}`}
                  onClick={() => trading.selectAsset(asset)}
                >
                  <div className="watchlist-quote-main">
                    <div>
                      <strong>{asset.symbol}</strong>
                      <span>{asset.name}</span>
                    </div>
                  </div>
                  <div className="watchlist-quote-side">
                    <strong>{formatAssetPrice(asset.livePrice || asset.price, asset.assetType)}</strong>
                    <span className={asset.change >= 0 ? 'text-positive' : 'text-negative'}>
                      {asset.change >= 0 ? '+' : ''}
                      {Number(asset.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                  <span
                    className="watchlist-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      trading.removeWatchlistSymbol(asset.symbol);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    Remove
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-panel small">Search NSE stocks or crypto pairs to build your watchlist.</div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="market-list">
            <div className="table-head neutral market-grid wide">
              <span>Symbol</span>
              <span>Name</span>
              <span>Exchange</span>
              <span>Cap</span>
              <span>Price</span>
              <span>Change</span>
              <span>Action</span>
            </div>

            {marketRows.length ? (
              marketRows.map((asset) => (
                <div className="table-row neutral market-grid wide" key={asset.symbol}>
                  <span>{asset.symbol}</span>
                  <span>{asset.name}</span>
                  <span>{asset.exchange}</span>
                  <span>{asset.marketCapCategory || 'Unclassified'}</span>
                  <span>{formatAssetPrice(asset.price, asset.assetType || ASSET_TYPES.STOCKS)}</span>
                  <span className={asset.change >= 0 ? 'text-positive' : 'text-negative'}>
                    {asset.change >= 0 ? '+' : ''}
                    {Number(asset.changePercent || 0).toFixed(2)}%
                  </span>
                  <div className="market-actions">
                    <button
                      className="secondary-button"
                      onClick={() => trading.addSymbolToWatchlist(asset)}
                      disabled={watchedSymbols.has(asset.symbol)}
                    >
                      {watchedSymbols.has(asset.symbol) ? 'Added' : 'Watch'}
                    </button>
                    <button
                      className="table-action"
                      onClick={async () => {
                        await trading.selectAsset(asset);
                        navigate('/trade');
                      }}
                    >
                      Trade
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-panel">
                {loading ? 'Loading market symbols...' : 'No symbols match the current search and filter.'}
              </div>
            )}
          </div>

          <div className="pagination-row">
            <button
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>
              Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}
            </span>
            <button
              className="secondary-button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default MarketPage;
