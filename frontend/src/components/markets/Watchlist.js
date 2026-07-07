import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatINR } from '../../constants';
import { normalizeIndianStock, normalizeIndianSymbol } from './marketUtils';

const USER_ID = 'user_001';

function Watchlist({ trading, onSelectStock }) {
  const [query, setQuery] = useState('');
  const [symbolInput, setSymbolInput] = useState('');
  const watchlistStocks = useMemo(
    () => (trading.watchlistDetails || [])
      .map(normalizeIndianStock)
      .filter((asset) => asset.symbol.endsWith('.NS') || asset.symbol.endsWith('.BO') || asset.exchange === 'NSE' || asset.exchange === 'BSE' || !asset.exchange),
    [trading.watchlistDetails]
  );
  const filtered = watchlistStocks.filter((asset) => {
    const needle = query.trim().toUpperCase();
    return !needle || asset.symbol.includes(needle) || String(asset.name || '').toUpperCase().includes(needle);
  });

  const persistOrder = async (symbols) => {
    trading.setWatchlist(symbols);
    await axios.put(`${API_BASE_URL}/api/market/watchlist/${USER_ID}`, {
      symbols: symbols.map((symbol) => ({ symbol, assetType: 'stocks' }))
    });
  };

  const addSymbol = async (event) => {
    event.preventDefault();
    const normalizedSymbol = normalizeIndianSymbol(symbolInput);
    if (!normalizedSymbol) return;
    await trading.addSymbolToWatchlist(normalizedSymbol);
    setSymbolInput('');
  };

  const move = async (symbol, direction) => {
    const current = [...trading.watchlist];
    const index = current.indexOf(symbol);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    await persistOrder(current);
  };

  const favorite = async (symbol) => {
    const current = [...trading.watchlist];
    const next = [symbol, ...current.filter((item) => item !== symbol)];
    await persistOrder(next);
  };

  return (
    <section className="markets-side-card markets-watchlist">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MarketWatch</p>
          <h3>Watchlist</h3>
        </div>
      </div>
      <form className="markets-watchlist-add" onSubmit={addSymbol}>
        <input value={symbolInput} onChange={(event) => setSymbolInput(event.target.value)} placeholder="Add NSE symbol" />
        <button type="submit" className="primary-button">Add</button>
      </form>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search watchlist" />
      <div className="markets-watchlist-list">
        {filtered.length ? filtered.map((asset) => (
          <div className="markets-watchlist-row" key={asset.symbol}>
            <button type="button" onClick={() => onSelectStock(asset)}>
              <span className={`favorite-star ${(trading.watchlist || [])[0] === asset.symbol ? 'active' : ''}`}>★</span>
              <span><strong>{asset.symbol}</strong><small>{asset.name}</small></span>
              <span><strong>{formatINR(asset.price)}</strong><small className={asset.changePercent >= 0 ? 'text-positive' : 'text-negative'}>{asset.changePercent.toFixed(2)}%</small></span>
            </button>
            <div>
              <button type="button" aria-label={`Favorite ${asset.symbol}`} onClick={() => favorite(asset.symbol)}>★</button>
              <button type="button" aria-label={`Move ${asset.symbol} up`} onClick={() => move(asset.symbol, -1)}>↑</button>
              <button type="button" aria-label={`Move ${asset.symbol} down`} onClick={() => move(asset.symbol, 1)}>↓</button>
              <button type="button" onClick={() => trading.removeWatchlistSymbol(asset.symbol)}>Remove</button>
            </div>
          </div>
        )) : <div className="empty-panel small">Add NSE stocks from the table to build your watchlist.</div>}
      </div>
    </section>
  );
}

export default Watchlist;
