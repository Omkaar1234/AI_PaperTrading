import React, { useEffect, useMemo, useRef } from 'react';
import { CrosshairMode, createChart } from 'lightweight-charts';
import { formatAssetPrice } from '../constants';

const INTERVALS = ['1m', '5m', '1h', '1d'];
const RANGES = ['1d', '5d', '1mo'];

function toUnixTime(value, fallbackIndex) {
  const time = value ? new Date(value).getTime() : Date.now() + fallbackIndex * 60000;
  return Math.floor(time / 1000);
}

function normalizeCandles(chartData) {
  const seen = new Set();

  return chartData
    .map((candle, index) => ({
      time: toUnixTime(candle.time || candle.timestamp || candle.date, index),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume || 0)
    }))
    .filter((candle) => {
      const valid = [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite);
      if (!valid || seen.has(candle.time)) {
        return false;
      }
      seen.add(candle.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

function ChartCard({
  assetInfo,
  chartData,
  chartInterval,
  chartRange,
  loading,
  priceChange,
  selectedAsset,
  setChartInterval,
  setChartRange
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const viewportKeyRef = useRef('');

  const candles = useMemo(() => normalizeCandles(chartData), [chartData]);
  const currentPrice = assetInfo?.currentPrice ?? selectedAsset?.price ?? null;
  const isPositive = Number(priceChange?.percent || 0) >= 0;

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 460,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8fa3bf',
        fontFamily: "'Segoe UI Variable Display', 'Segoe UI', sans-serif"
      },
      grid: {
        vertLines: { color: 'rgba(148, 170, 196, 0.08)' },
        horzLines: { color: 'rgba(148, 170, 196, 0.08)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(143, 163, 191, 0.38)', labelBackgroundColor: '#172338' },
        horzLine: { color: 'rgba(143, 163, 191, 0.38)', labelBackgroundColor: '#172338' }
      },
      rightPriceScale: {
        borderColor: 'rgba(49, 69, 100, 0.7)',
        scaleMargins: { top: 0.08, bottom: 0.26 }
      },
      timeScale: {
        borderColor: 'rgba(49, 69, 100, 0.7)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 9
      },
      handleScale: true,
      handleScroll: true
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#24c48e',
      downColor: '#f05264',
      borderUpColor: '#24c48e',
      borderDownColor: '#f05264',
      wickUpColor: '#24c48e',
      wickDownColor: '#f05264',
      priceLineColor: '#53a6ff',
      lastValueVisible: true
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.78, bottom: 0 }
    });

    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderColor: 'rgba(49, 69, 100, 0.7)'
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    candleSeriesRef.current.setData(candles.map(({ volume, ...candle }) => candle));
    volumeSeriesRef.current.setData(candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(36, 196, 142, 0.34)' : 'rgba(240, 82, 100, 0.34)'
    })));

    const viewportKey = `${selectedAsset?.symbol || 'none'}:${chartInterval}:${chartRange}`;
    if (candles.length && chartRef.current && viewportKeyRef.current !== viewportKey) {
      viewportKeyRef.current = viewportKey;
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, chartInterval, chartRange, selectedAsset?.symbol]);

  return (
    <section className="card chart-card">
      <div className="section-heading chart-heading">
        <div>
          <p className="eyebrow">Live market</p>
          <h3>{selectedAsset?.symbol || '--'}</h3>
          {selectedAsset?.name ? <p className="chart-subtitle">{selectedAsset.name}</p> : null}
        </div>
        <div className="price-block">
          <strong>{currentPrice === null ? '--' : formatAssetPrice(currentPrice, selectedAsset?.assetType)}</strong>
          <span className={isPositive ? 'text-positive' : 'text-negative'}>
            {isPositive ? '+' : ''}
            {Number(priceChange?.value || 0).toFixed(2)} ({Number(priceChange?.percent || 0).toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="chart-toolbar">
        <div className="mini-segments">
          {INTERVALS.map((interval) => (
            <button
              key={interval}
              className={chartInterval === interval ? 'active' : ''}
              onClick={() => setChartInterval(interval)}
            >
              {interval}
            </button>
          ))}
        </div>
        <div className="mini-segments">
          {RANGES.map((range) => (
            <button
              key={range}
              className={chartRange === range ? 'active' : ''}
              onClick={() => setChartRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="mini-stats">
        <div>
          <span>Day High</span>
          <strong>{assetInfo?.dayHigh ? formatAssetPrice(assetInfo.dayHigh, selectedAsset?.assetType) : '--'}</strong>
        </div>
        <div>
          <span>Day Low</span>
          <strong>{assetInfo?.dayLow ? formatAssetPrice(assetInfo.dayLow, selectedAsset?.assetType) : '--'}</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{assetInfo?.volume ? `${(assetInfo.volume / 1000000).toFixed(2)}M` : '--'}</strong>
        </div>
      </div>

      <div className="chart-wrap">
        {loading && <div className="chart-loading">Updating market data...</div>}
        <div className="tv-chart-container" ref={containerRef} />
        {!candles.length && (
          <div className="empty-panel">No chart data available for this symbol.</div>
        )}
      </div>
    </section>
  );
}

export default ChartCard;
