import React from 'react';
import { buildMarketCandles } from './marketUtils';

const RANGE_COUNTS = {
  '1D': 30,
  '1W': 36,
  '1M': 44,
  '3M': 52,
  '1Y': 60,
  '5Y': 72
};

function MiniChart({ price, changePercent, variant = 'spark', range = '1D', indicators = [] }) {
  const candles = buildMarketCandles(price, changePercent, variant === 'candle' ? RANGE_COUNTS[range] || 30 : 14);
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const priceRange = max - min || 1;

  if (variant === 'candle') {
    return (
      <svg className="market-mini-chart candle" viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">
        {candles.map((candle, index) => {
          const x = 8 + index * (304 / candles.length);
          const highY = 140 - ((candle.high - min) / priceRange) * 130;
          const lowY = 140 - ((candle.low - min) / priceRange) * 130;
          const openY = 140 - ((candle.open - min) / priceRange) * 130;
          const closeY = 140 - ((candle.close - min) / priceRange) * 130;
          const positive = candle.close >= candle.open;
          return (
            <g key={`${index}-${candle.close}`} className={positive ? 'positive' : 'negative'}>
              {indicators.includes('Volume') ? <rect className="volume-bar" x={x - 3} y={132 - (candle.volume / 1100000) * 18} width="6" height={(candle.volume / 1100000) * 18} rx="1" /> : null}
              <line x1={x} x2={x} y1={highY} y2={lowY} />
              <rect x={x - 3} y={Math.min(openY, closeY)} width="6" height={Math.max(2, Math.abs(closeY - openY))} rx="1" />
            </g>
          );
        })}
        {indicators.includes('SMA') ? <polyline className="indicator sma" points={candles.map((candle, index) => `${8 + index * (304 / candles.length)},${140 - ((candle.close - min) / priceRange) * 124}`).join(' ')} /> : null}
        {indicators.includes('EMA') ? <polyline className="indicator ema" points={candles.map((candle, index) => `${8 + index * (304 / candles.length)},${134 - ((candle.open - min) / priceRange) * 118}`).join(' ')} /> : null}
      </svg>
    );
  }

  const points = candles
    .map((candle, index) => {
      const x = (index / Math.max(1, candles.length - 1)) * 100;
      const y = 36 - ((candle.close - min) / priceRange) * 30;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={`market-mini-chart ${changePercent >= 0 ? 'positive' : 'negative'}`} viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default MiniChart;
