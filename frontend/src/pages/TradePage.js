import React, { useEffect, useState } from 'react';
import ChartCard from '../components/ChartCard';
import TerminalDock from '../components/TerminalDock';
import TradeFormCard from '../components/TradeFormCard';

function TradePage({ trading }) {
  const selectedSymbol = trading.selectedAsset?.symbol;
  const lookupSymbols = trading.lookupSymbols;
  const resolveAsset = trading.resolveAsset;
  const selectAsset = trading.selectAsset;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (selectedSymbol) {
      setQuery(selectedSymbol);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    let ignore = false;
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setSearchLoading(false);
      return undefined;
    }

    const runLookup = async () => {
      try {
        setSearchLoading(true);
        const matches = await lookupSymbols(trimmed, { limit: 8 });
        if (!ignore) {
          setResults(matches);
        }
      } catch (error) {
        if (!ignore) {
          setResults([]);
        }
      } finally {
        if (!ignore) {
          setSearchLoading(false);
        }
      }
    };

    const timer = window.setTimeout(runLookup, 180);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [lookupSymbols, query]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const exact =
      results.find(
        (asset) =>
          asset.symbol.toUpperCase() === trimmed.toUpperCase() ||
          asset.baseSymbol?.toUpperCase() === trimmed.toUpperCase()
      ) || (await resolveAsset(trimmed));

    if (exact?.symbol) {
      await selectAsset(exact);
      setQuery(exact.symbol);
      setResults([]);
    }
  };

  return (
    <div className="page trade-page">
      <section className="card symbol-search-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Instrument Selection</p>
            <h3>Search NSE Equities & Crypto</h3>
          </div>
        </div>

        <form className="symbol-search-shell" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Reliance, TCS, BTC, ETH, SOL"
          />
          {searchLoading ? <div className="symbol-search-status">Searching symbols...</div> : null}
          {results.length ? (
            <div className="symbol-search-dropdown">
              {results.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  className="symbol-search-item"
                  onClick={async () => {
                    await selectAsset(asset);
                    setQuery(asset.symbol);
                    setResults([]);
                  }}
                >
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
          ) : !searchLoading && query.trim() ? (
            <div className="symbol-search-status">No matching symbols found.</div>
          ) : null}
        </form>
      </section>

      <div className="trade-terminal-grid">
        <ChartCard
          assetInfo={trading.assetInfo}
          chartData={trading.chartData}
          chartInterval={trading.chartInterval}
          chartRange={trading.chartRange}
          loading={trading.loading}
          priceChange={trading.priceChange}
          selectedAsset={trading.selectedAsset}
          setChartInterval={trading.setChartInterval}
          setChartRange={trading.setChartRange}
        />

        <TradeFormCard
          assetInfo={trading.assetInfo}
          handlePlaceOrder={trading.handlePlaceOrder}
          orderType={trading.orderType}
          positions={trading.positions}
          selectedAsset={trading.selectedAsset}
          setOrderType={trading.setOrderType}
          setTradeMode={trading.setTradeMode}
          setTradePrice={trading.setTradePrice}
          setTradeQuantity={trading.setTradeQuantity}
          tradeMode={trading.tradeMode}
          tradePrice={trading.tradePrice}
          tradeQuantity={trading.tradeQuantity}
          user={trading.user}
          isSubmittingOrder={trading.isSubmittingOrder}
        />
      </div>

      <TerminalDock
        activeDockTab={trading.activeDockTab}
        cancelOrder={trading.cancelOrder}
        orders={trading.orders}
        positions={trading.positions}
        recentTrades={trading.recentTrades}
        selectAsset={trading.selectAsset}
        setActiveDockTab={trading.setActiveDockTab}
        cancellingOrderId={trading.cancellingOrderId}
      />
    </div>
  );
}

export default TradePage;
