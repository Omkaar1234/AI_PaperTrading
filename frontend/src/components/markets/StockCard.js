import React from 'react';
import { formatINR } from '../../constants';
import { formatMarketCap } from './marketUtils';

function StockCard({ stock, active, onClick }) {
  return (
    <button type="button" className={`stock-card ${active ? 'active' : ''}`} onClick={() => onClick(stock)}>
      <span className="stock-logo">{stock.logoText}</span>
      <span>
        <strong>{stock.symbol}</strong>
        <small>{stock.name}</small>
      </span>
      <span>
        <strong>{formatINR(stock.price)}</strong>
        <small className={stock.changePercent >= 0 ? 'text-positive' : 'text-negative'}>
          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
        </small>
      </span>
      <em>{formatMarketCap(stock.marketCap)}</em>
    </button>
  );
}

export default StockCard;
