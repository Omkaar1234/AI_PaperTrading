import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../constants';
import { formatMarketCap } from './marketUtils';

const COLUMNS = [
  { label: 'Company', width: 260, min: 220 },
  { label: 'NSE Symbol', width: 126, min: 110 },
  { label: 'Price', width: 124, min: 110 },
  { label: 'Change', width: 116, min: 100 },
  { label: '%', width: 88, min: 78 },
  { label: 'Open', width: 112, min: 96 },
  { label: 'High', width: 112, min: 96 },
  { label: 'Low', width: 112, min: 96 },
  { label: 'Prev Close', width: 122, min: 108 },
  { label: 'Volume', width: 128, min: 112 },
  { label: 'Market Cap', width: 132, min: 116 },
  { label: '52W High', width: 122, min: 108 },
  { label: '52W Low', width: 122, min: 108 },
  { label: 'Actions', width: 236, min: 220 }
];

function MarketTable({ rows, loading, watchedSymbols, onSort, sortKey, onSelectStock, onWatch, trading }) {
  const navigate = useNavigate();
  const [widths, setWidths] = useState(() => COLUMNS.map((column) => column.width));
  const gridTemplateColumns = useMemo(() => widths.map((width) => `${width}px`).join(' '), [widths]);

  const startResize = (event, columnIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[columnIndex];

    const onMove = (moveEvent) => {
      const nextWidth = Math.max(COLUMNS[columnIndex].min, startWidth + moveEvent.clientX - startX);
      setWidths((current) => current.map((width, index) => (index === columnIndex ? nextWidth : width)));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tradeStock = async (stock) => {
    await trading.selectAsset(stock);
    navigate('/trade');
  };

  const analyzeStock = async (stock) => {
    await trading.selectAsset(stock);
    navigate('/prediction');
  };

  return (
    <section className="markets-table-panel">
      <div className="markets-table-scroll">
        <div className="markets-table-head" style={{ gridTemplateColumns }}>
          {COLUMNS.map(({ label }, index) => (
            <div className="markets-table-heading-cell" key={label}>
              <button type="button" onClick={() => onSort(label)}>
                {label}{sortKey === label ? ' ↓' : ''}
              </button>
              {index < COLUMNS.length - 1 ? (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  tabIndex={0}
                  className="column-resizer"
                  onMouseDown={(event) => startResize(event, index)}
                />
              ) : null}
            </div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, index) => <div className="markets-table-skeleton skeleton" key={index} />)
        ) : rows.length ? (
          rows.map((stock) => (
            <div className="markets-table-row" style={{ gridTemplateColumns }} key={stock.symbol} onClick={() => onSelectStock(stock)}>
              <span className="markets-company-cell">
                <span className="stock-logo">{stock.logoText}</span>
                <span><strong>{stock.name}</strong><small>{stock.sector}</small></span>
              </span>
              <span>{stock.symbol}</span>
              <span>{formatINR(stock.price)}</span>
              <span className={stock.change >= 0 ? 'text-positive' : 'text-negative'}>{stock.change >= 0 ? '+' : ''}{formatINR(stock.change)}</span>
              <span className={stock.changePercent >= 0 ? 'text-positive' : 'text-negative'}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
              <span>{formatINR(stock.open)}</span>
              <span>{formatINR(stock.high)}</span>
              <span>{formatINR(stock.low)}</span>
              <span>{formatINR(stock.previousClose)}</span>
              <span>{Number(stock.volume || 0).toLocaleString('en-IN')}</span>
              <span>{formatMarketCap(stock.marketCap)}</span>
              <span>{formatINR(stock.weekHigh52)}</span>
              <span>{formatINR(stock.weekLow52)}</span>
              <span className="markets-action-cell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="secondary-button" onClick={() => onWatch(stock)} disabled={watchedSymbols.has(stock.symbol)}>
                  {watchedSymbols.has(stock.symbol) ? '★' : '☆'}
                </button>
                <button type="button" className="table-action" onClick={() => tradeStock(stock)}>Trade</button>
                <button type="button" className="secondary-button" onClick={() => analyzeStock(stock)}>AI</button>
              </span>
            </div>
          ))
        ) : (
          <div className="empty-panel">No NSE/BSE stocks match the selected filters.</div>
        )}
      </div>
    </section>
  );
}

export default MarketTable;
