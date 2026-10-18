import React, { useState, useMemo } from 'react';
import { formatINR } from '../constants';

function OrderBookCard({
  compact = false,
  orderBook = { bids: [], asks: [] },
  selectedAsset = null,
  loading = false,
  error = null,
  isEngineConnected = true,
  lastUpdated = null,
  onRefresh = null
}) {
  const [depthMode, setDepthMode] = useState('cumulative'); // 'cumulative' | 'single'
  const [mobileView, setMobileView] = useState('both'); // 'both' | 'bids' | 'asks'

  const symbol = orderBook?.symbol || selectedAsset?.symbol || 'Instrument';

  // Normalize bids: sorted descending by price (highest bid first)
  const sortedBids = useMemo(() => {
    const list = Array.isArray(orderBook?.bids) ? orderBook.bids : [];
    return [...list]
      .filter((o) => Number(o.price) > 0 && Number(o.remaining ?? o.remaining_qty ?? o.quantity ?? 0) > 0)
      .sort((a, b) => Number(b.price) - Number(a.price));
  }, [orderBook?.bids]);

  // Normalize asks: sorted ascending by price (lowest ask first)
  const sortedAsks = useMemo(() => {
    const list = Array.isArray(orderBook?.asks) ? orderBook.asks : [];
    return [...list]
      .filter((o) => Number(o.price) > 0 && Number(o.remaining ?? o.remaining_qty ?? o.quantity ?? 0) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price));
  }, [orderBook?.asks]);

  const displayBids = compact ? sortedBids.slice(0, 8) : sortedBids.slice(0, 15);
  const displayAsks = compact ? sortedAsks.slice(0, 8) : sortedAsks.slice(0, 15);

  // Microstructure calculations: Best Bid & Best Ask
  const bestBid = sortedBids.length > 0 ? Number(sortedBids[0].price) : null;
  const bestAsk = sortedAsks.length > 0 ? Number(sortedAsks[0].price) : null;

  // Spread and midpoint: valid only if both exist, positive, and non-crossed
  const isValidSpread = bestBid !== null && bestAsk !== null && bestAsk >= bestBid && bestAsk > 0;
  const spread = isValidSpread ? bestAsk - bestBid : null;
  const spreadPercent = isValidSpread ? ((spread / bestAsk) * 100).toFixed(2) : null;
  const spreadBps = isValidSpread ? Math.round((spread / bestAsk) * 10000) : null;
  const midpoint = isValidSpread ? (bestBid + bestAsk) / 2 : null;

  // Calculate cumulative depth totals
  const { bidsWithTotals, totalBidQty, maxSingleBidQty } = useMemo(() => {
    let cumQty = 0;
    let maxSingle = 1;
    const items = displayBids.map((order, idx) => {
      const qty = Number(order.remaining ?? order.remaining_qty ?? order.quantity ?? 0);
      const price = Number(order.price || 0);
      cumQty += qty;
      if (qty > maxSingle) maxSingle = qty;
      return {
        id: order.id || `bid-${idx}`,
        price,
        qty,
        cumQty,
        totalVal: qty * price
      };
    });
    return { bidsWithTotals: items, totalBidQty: cumQty, maxSingleBidQty: maxSingle };
  }, [displayBids]);

  const { asksWithTotals, totalAskQty, maxSingleAskQty } = useMemo(() => {
    let cumQty = 0;
    let maxSingle = 1;
    const items = displayAsks.map((order, idx) => {
      const qty = Number(order.remaining ?? order.remaining_qty ?? order.quantity ?? 0);
      const price = Number(order.price || 0);
      cumQty += qty;
      if (qty > maxSingle) maxSingle = qty;
      return {
        id: order.id || `ask-${idx}`,
        price,
        qty,
        cumQty,
        totalVal: qty * price
      };
    });
    return { asksWithTotals: items, totalAskQty: cumQty, maxSingleAskQty: maxSingle };
  }, [displayAsks]);

  // Overall maximums for proportional bar scaling
  const maxDepthQty = Math.max(1, depthMode === 'cumulative' ? Math.max(totalBidQty, totalAskQty) : Math.max(maxSingleBidQty, maxSingleAskQty));

  // Imbalance Ratio
  const totalVolume = totalBidQty + totalAskQty;
  const bidRatio = totalVolume > 0 ? Math.round((totalBidQty / totalVolume) * 100) : 50;
  const askRatio = 100 - bidRatio;

  const hasBids = bidsWithTotals.length > 0;
  const hasAsks = asksWithTotals.length > 0;
  const isBookEmpty = !hasBids && !hasAsks;

  const resolvedError = error || orderBook?.error || (!isEngineConnected ? 'Matching engine disconnected' : null);

  return (
    <section className="card orderbook-terminal-card" aria-label="Market order book depth">
      {/* HEADER ROW */}
      <div className="orderbook-header-row">
        <div className="orderbook-title-group">
          <div className="orderbook-eyebrow-row">
            <span className="orderbook-eyebrow">Level 2 Market Depth</span>
            <span className="orderbook-scope-badge" title="Simulated order book executed in UPRISE matching engine">
              Matching Engine Book
            </span>
          </div>
          <div className="orderbook-heading-flex">
            <h3 className="orderbook-title">{symbol}</h3>
            {selectedAsset?.name && <span className="orderbook-asset-name text-muted">· {selectedAsset.name}</span>}
          </div>
        </div>

        <div className="orderbook-controls-group">
          {/* DEPTH MODE TOGGLE */}
          <div className="orderbook-mode-toggle" role="group" aria-label="Depth visualization mode">
            <button
              type="button"
              className={`mode-btn ${depthMode === 'cumulative' ? 'active' : ''}`}
              onClick={() => setDepthMode('cumulative')}
              title="Show cumulative depth accumulation"
            >
              Cumulative
            </button>
            <button
              type="button"
              className={`mode-btn ${depthMode === 'single' ? 'active' : ''}`}
              onClick={() => setDepthMode('single')}
              title="Show individual order quantities"
            >
              Order Qty
            </button>
          </div>

          {/* REFRESH / STATUS */}
          <div className="orderbook-status-pill">
            <span
              className={`status-pulse-dot ${
                resolvedError ? 'error-dot' : loading ? 'loading-dot' : 'live-dot'
              }`}
            />
            <span className="status-text tabular-nums">
              {loading ? 'Updating...' : lastUpdated ? `Synced ${lastUpdated}` : 'Real-time Feed'}
            </span>
            {onRefresh && (
              <button
                type="button"
                className="orderbook-refresh-icon-btn"
                onClick={onRefresh}
                title="Refresh order book"
                disabled={loading}
                aria-label="Refresh order book"
              >
                ↻
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DISCONNECTED OR ERROR ALERT BANNER */}
      {resolvedError && (
        <div className="orderbook-error-banner" role="alert">
          <div className="error-icon" aria-hidden="true">⚠️</div>
          <div className="error-body">
            <strong>Matching Engine Offline:</strong> {resolvedError}. Live depth streaming paused.
          </div>
          {onRefresh && (
            <button type="button" className="retry-action-btn" onClick={onRefresh}>
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* MICROSTRUCTURE METRICS BAR */}
      <div className="orderbook-microstructure-bar">
        <div className="microstructure-stat">
          <span className="stat-label">Best Bid</span>
          <span className="stat-value text-positive tabular-nums">
            {bestBid !== null ? formatINR(bestBid) : '—'}
          </span>
        </div>

        <div className="microstructure-stat">
          <span className="stat-label">Spread</span>
          <div className="stat-value tabular-nums">
            {spread !== null ? (
              <>
                <strong className="spread-amount">₹{spread.toFixed(2)}</strong>
                <span className="spread-details text-muted">
                  ({spreadPercent}% · {spreadBps} bps)
                </span>
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>

        <div className="microstructure-stat">
          <span className="stat-label">Midpoint</span>
          <span className="stat-value text-primary tabular-nums">
            {midpoint !== null ? `₹${midpoint.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="microstructure-stat">
          <span className="stat-label">Best Ask</span>
          <span className="stat-value text-negative tabular-nums">
            {bestAsk !== null ? formatINR(bestAsk) : '—'}
          </span>
        </div>
      </div>

      {/* IMBALANCE BAR */}
      {totalVolume > 0 && (
        <div className="orderbook-imbalance-row" title={`Order depth imbalance: ${bidRatio}% Bids vs ${askRatio}% Asks`}>
          <div className="imbalance-label-left text-positive tabular-nums">
            <span>Bids {totalBidQty.toLocaleString('en-IN')} units</span>
            <strong>{bidRatio}%</strong>
          </div>
          <div className="imbalance-track" aria-hidden="true">
            <div className="imbalance-fill-bid" style={{ width: `${bidRatio}%` }} />
            <div className="imbalance-fill-ask" style={{ width: `${askRatio}%` }} />
          </div>
          <div className="imbalance-label-right text-negative tabular-nums">
            <strong>{askRatio}%</strong>
            <span>Asks {totalAskQty.toLocaleString('en-IN')} units</span>
          </div>
        </div>
      )}

      {/* MOBILE VIEW TOGGLE (Shown only on small viewports) */}
      <div className="orderbook-mobile-view-toggle" role="tablist" aria-label="Book side view">
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'both'}
          className={`mobile-view-tab ${mobileView === 'both' ? 'active' : ''}`}
          onClick={() => setMobileView('both')}
        >
          Both Sides
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'bids'}
          className={`mobile-view-tab bids-tab ${mobileView === 'bids' ? 'active' : ''}`}
          onClick={() => setMobileView('bids')}
        >
          Bids ({bidsWithTotals.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'asks'}
          className={`mobile-view-tab asks-tab ${mobileView === 'asks' ? 'active' : ''}`}
          onClick={() => setMobileView('asks')}
        >
          Asks ({asksWithTotals.length})
        </button>
      </div>

      {/* DUAL ORDER BOOK GRID */}
      {loading && isBookEmpty ? (
        <div className="orderbook-skeleton-grid" aria-label="Loading order depth...">
          <div className="skeleton-col">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
          <div className="skeleton-col">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </div>
      ) : isBookEmpty ? (
        <div className="orderbook-empty-state">
          <div className="empty-state-icon">📭</div>
          <h4>Order Book is Empty</h4>
          <p>
            No active resting limit orders for <strong>{symbol}</strong> in the UPRISE matching engine.
          </p>
          <div className="empty-state-hint">
            <strong>Trading Notice:</strong> Market orders submitted into an empty book cancel immediately to protect against zero-liquidity execution. Place a <strong>Limit Order</strong> to provide initial resting liquidity.
          </div>
        </div>
      ) : (
        <div className={`orderbook-dual-grid mobile-view-${mobileView}`}>
          {/* BUY / BIDS COLUMN */}
          {(mobileView === 'both' || mobileView === 'bids') && (
            <div className="orderbook-half orderbook-bids-half">
              <div className="orderbook-side-title buy-side-title">
                <span className="side-indicator-dot buy-dot" aria-hidden="true" />
                <span className="side-title-text">BUY ORDERS (BIDS)</span>
                <span className="side-depth-badge text-positive tabular-nums">
                  {totalBidQty.toLocaleString('en-IN')} units
                </span>
              </div>

              <div className="orderbook-table-wrap">
                <table className="orderbook-table bids-table" aria-label="Buy orders table">
                  <thead>
                    <tr>
                      <th className="text-left">Price (₹)</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Cum. Qty</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasBids ? (
                      bidsWithTotals.map((order) => {
                        const fillWidth = Math.min(
                          100,
                          Math.max(3, Math.round(((depthMode === 'cumulative' ? order.cumQty : order.qty) / maxDepthQty) * 100))
                        );

                        return (
                          <tr key={order.id} className="orderbook-row bid-row">
                            <td className="text-left font-semibold text-positive tabular-nums price-cell">
                              <span
                                className="depth-fill buy-depth-fill"
                                style={{ width: `${fillWidth}%` }}
                                aria-hidden="true"
                              />
                              <span className="cell-content">
                                {order.price.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </td>
                            <td className="text-right tabular-nums cell-content">
                              {order.qty.toLocaleString('en-IN')}
                            </td>
                            <td className="text-right tabular-nums text-muted cell-content">
                              {order.cumQty.toLocaleString('en-IN')}
                            </td>
                            <td className="text-right tabular-nums text-muted cell-content">
                              {order.totalVal.toLocaleString('en-IN', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-row text-center text-muted">
                          No active buy orders
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SELL / ASKS COLUMN */}
          {(mobileView === 'both' || mobileView === 'asks') && (
            <div className="orderbook-half orderbook-asks-half">
              <div className="orderbook-side-title sell-side-title">
                <span className="side-indicator-dot sell-dot" aria-hidden="true" />
                <span className="side-title-text">SELL ORDERS (ASKS)</span>
                <span className="side-depth-badge text-negative tabular-nums">
                  {totalAskQty.toLocaleString('en-IN')} units
                </span>
              </div>

              <div className="orderbook-table-wrap">
                <table className="orderbook-table asks-table" aria-label="Sell orders table">
                  <thead>
                    <tr>
                      <th className="text-left">Price (₹)</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Cum. Qty</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasAsks ? (
                      asksWithTotals.map((order) => {
                        const fillWidth = Math.min(
                          100,
                          Math.max(3, Math.round(((depthMode === 'cumulative' ? order.cumQty : order.qty) / maxDepthQty) * 100))
                        );

                        return (
                          <tr key={order.id} className="orderbook-row ask-row">
                            <td className="text-left font-semibold text-negative tabular-nums price-cell">
                              <span
                                className="depth-fill sell-depth-fill"
                                style={{ width: `${fillWidth}%` }}
                                aria-hidden="true"
                              />
                              <span className="cell-content">
                                {order.price.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </td>
                            <td className="text-right tabular-nums cell-content">
                              {order.qty.toLocaleString('en-IN')}
                            </td>
                            <td className="text-right tabular-nums text-muted cell-content">
                              {order.cumQty.toLocaleString('en-IN')}
                            </td>
                            <td className="text-right tabular-nums text-muted cell-content">
                              {order.totalVal.toLocaleString('en-IN', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-row text-center text-muted">
                          No active sell orders
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER SCOPE NOTICE */}
      <div className="orderbook-scope-footer">
        <span className="scope-icon" aria-hidden="true">ℹ️</span>
        <span className="scope-note">
          <strong>UPRISE Matching Scope:</strong> Live depth displays unexecuted orders in UPRISE's price-time priority engine. It does not reflect consolidated exchange order books or external broker feeds.
        </span>
      </div>
    </section>
  );
}

export default OrderBookCard;
