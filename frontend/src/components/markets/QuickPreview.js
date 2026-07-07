import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../constants';
import MiniChart from './MiniChart';
import { formatMarketCap } from './marketUtils';

const RANGES = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const INDICATORS = ['EMA', 'SMA', 'Volume'];

function QuickPreview({ stock, trading }) {
  const navigate = useNavigate();
  const [range, setRange] = useState('1D');
  const [indicators, setIndicators] = useState(['Volume']);

  if (!stock) {
    return (
      <section className="markets-side-card quick-preview-panel">
        <div className="empty-panel">Select a stock to open the quick preview.</div>
      </section>
    );
  }

  const trade = async () => {
    await trading.selectAsset(stock);
    navigate('/trade');
  };

  const analyze = async () => {
    await trading.selectAsset(stock);
    navigate('/prediction');
  };

  return (
    <section className="markets-side-card quick-preview-panel">
      <div className="quick-preview-heading">
        <span className="stock-logo large">{stock.logoText}</span>
        <div>
          <p className="eyebrow">{stock.symbol}</p>
          <h3>{stock.name}</h3>
          <small>{stock.sector} · {stock.exchange || 'NSE'}</small>
        </div>
      </div>

      <div className="quick-preview-price">
        <strong>{formatINR(stock.price)}</strong>
        <span className={stock.changePercent >= 0 ? 'text-positive' : 'text-negative'}>{stock.change >= 0 ? '+' : ''}{formatINR(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)</span>
      </div>

      <MiniChart price={stock.price} changePercent={stock.changePercent} variant="candle" range={range} indicators={indicators} />

      <div className="mini-segments market-chart-ranges">
        {RANGES.map((item) => <button type="button" key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}
      </div>

      <div className="market-indicators">
        {INDICATORS.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={indicators.includes(item)}
              onChange={() => setIndicators((current) => current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item])}
            />
            {item}
          </label>
        ))}
      </div>

      <div className="quick-preview-grid">
        <div><span>Volume</span><strong>{Number(stock.volume || 0).toLocaleString('en-IN')}</strong></div>
        <div><span>Market cap</span><strong>{formatMarketCap(stock.marketCap)}</strong></div>
        <div><span>P/E ratio</span><strong>{stock.peRatio.toFixed(1)}</strong></div>
        <div><span>52W high</span><strong>{formatINR(stock.weekHigh52)}</strong></div>
        <div><span>52W low</span><strong>{formatINR(stock.weekLow52)}</strong></div>
        <div><span>AI prediction</span><strong>{trading.suggestion?.action || trading.prediction?.prediction || 'Neutral'}</strong></div>
      </div>

      <div className="quick-preview-actions">
        <button type="button" className="primary-button" onClick={trade}>Quick Trade</button>
        <button type="button" className="secondary-button" onClick={analyze}>Open Full Analysis</button>
      </div>
    </section>
  );
}

export default QuickPreview;
