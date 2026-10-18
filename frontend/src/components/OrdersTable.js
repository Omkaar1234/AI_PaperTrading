import React, { useState, useMemo } from 'react';
import { formatINR } from '../constants';

function OrdersTable({
  cancelOrder,
  orders = [],
  embedded = false,
  cancellingOrderId = null
}) {
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'FILLED' | 'PARTIAL' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedOrders = useMemo(() => {
    return [...orders].map((order) => {
      const filledQty = Number(order.filled_qty ?? 0);
      const totalQty = Number(order.quantity || 1);
      const remainingQty = Number(order.remaining_qty ?? Math.max(0, totalQty - filledQty));
      const fillRatio = Math.min(100, Math.max(0, Math.round((filledQty / totalQty) * 100)));
      const rawStatus = String(order.status || 'OPEN').toUpperCase();

      return {
        ...order,
        filledQty,
        totalQty,
        remainingQty,
        fillRatio,
        rawStatus
      };
    });
  }, [orders]);

  // Metric aggregates
  const metrics = useMemo(() => {
    let active = 0;
    let filled = 0;
    let partial = 0;
    let cancelled = 0;
    let totalFilledUnits = 0;
    let totalOrderedUnits = 0;

    normalizedOrders.forEach((o) => {
      totalOrderedUnits += o.totalQty;
      totalFilledUnits += o.filledQty;
      if (o.rawStatus === 'OPEN' || o.rawStatus === 'PENDING_SUBMISSION') {
        active += 1;
      } else if (o.rawStatus === 'PARTIALLY_FILLED') {
        active += 1;
        partial += 1;
      } else if (o.rawStatus === 'FILLED') {
        filled += 1;
      } else if (o.rawStatus === 'CANCELLED' || o.rawStatus === 'REJECTED') {
        cancelled += 1;
      }
    });

    const overallFillRate = totalOrderedUnits > 0 ? Math.round((totalFilledUnits / totalOrderedUnits) * 100) : 0;
    return {
      total: normalizedOrders.length,
      active,
      filled,
      partial,
      cancelled,
      overallFillRate
    };
  }, [normalizedOrders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return normalizedOrders.filter((order) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!order.symbol.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (filterTab === 'ACTIVE') {
        return (
          order.rawStatus === 'OPEN' ||
          order.rawStatus === 'PARTIALLY_FILLED' ||
          order.rawStatus === 'PENDING_SUBMISSION'
        );
      }
      if (filterTab === 'FILLED') {
        return order.rawStatus === 'FILLED';
      }
      if (filterTab === 'PARTIAL') {
        return order.rawStatus === 'PARTIALLY_FILLED';
      }
      if (filterTab === 'CANCELLED') {
        return order.rawStatus === 'CANCELLED' || order.rawStatus === 'REJECTED';
      }
      return true;
    });
  }, [normalizedOrders, filterTab, searchQuery]);

  const getStatusBadge = (order) => {
    switch (order.rawStatus) {
      case 'FILLED':
        return <span className="status-chip status-filled">FILLED</span>;
      case 'PARTIALLY_FILLED':
        return <span className="status-chip status-partially_filled">PARTIAL</span>;
      case 'OPEN':
        return <span className="status-chip status-open">OPEN</span>;
      case 'CANCELLED':
        return <span className="status-chip status-cancelled">CANCELLED</span>;
      case 'REJECTED':
        return <span className="status-chip status-rejected">REJECTED</span>;
      case 'PENDING_SUBMISSION':
        return <span className="status-chip status-pending_submission">SUBMITTING</span>;
      default:
        return <span className="status-chip status-unknown">{order.rawStatus}</span>;
    }
  };

  const getLifecycleExplanation = (order) => {
    if (order.rawStatus === 'CANCELLED' && order.type === 'MARKET' && order.filledQty === 0) {
      return (
        <span className="order-note-subtext text-warning" title="Market order cancelled because no counterparty liquidity was resting in the book">
          Unfilled Market Order · Zero counterparty liquidity
        </span>
      );
    }
    if (order.rawStatus === 'CANCELLED') {
      return <span className="order-note-subtext text-muted">Order cancelled</span>;
    }
    if (order.rawStatus === 'PARTIALLY_FILLED') {
      return (
        <span className="order-note-subtext text-warning">
          {order.filledQty} filled @ ₹{Number(order.avg_fill_price || order.price || 0).toFixed(2)} · {order.remainingQty} resting
        </span>
      );
    }
    if (order.rawStatus === 'OPEN') {
      return <span className="order-note-subtext text-primary">Resting in matching engine book</span>;
    }
    if (order.rawStatus === 'FILLED') {
      return (
        <span className="order-note-subtext text-positive">
          Matched @ ₹{Number(order.avg_fill_price || order.price || 0).toFixed(2)}
        </span>
      );
    }
    if (order.rawStatus === 'REJECTED') {
      return <span className="order-note-subtext text-negative">Rejected by engine / risk boundary</span>;
    }
    return null;
  };

  return (
    <section className={embedded ? 'orders-embedded-container' : 'card orders-card'} aria-label="Orders history">
      {!embedded && (
        <div className="section-heading orders-heading-split">
          <div>
            <p className="eyebrow">Execution Records</p>
            <h3 className="orders-title">Order Lifecycle & Status</h3>
          </div>
          <div className="orders-top-actions">
            {orders.length > 5 && (
              <div className="orders-search-box">
                <input
                  type="text"
                  placeholder="Filter by symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="table-search-input"
                  aria-label="Filter orders by symbol"
                />
              </div>
            )}
            {orders.length > 0 && (
              <span className="badge-text neutral-badge">
                {orders.length} Total {orders.length === 1 ? 'Order' : 'Orders'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* METRIC CARDS STRIP */}
      {normalizedOrders.length > 0 && (
        <div className="orders-metrics-strip" role="region" aria-label="Order summary statistics">
          <div className="orders-metric-item">
            <span className="metric-label">Active Orders</span>
            <strong className="metric-val text-primary tabular-nums">{metrics.active}</strong>
          </div>
          <div className="orders-metric-item">
            <span className="metric-label">Fully Filled</span>
            <strong className="metric-val text-positive tabular-nums">{metrics.filled}</strong>
          </div>
          <div className="orders-metric-item">
            <span className="metric-label">Cancelled / Rejected</span>
            <strong className="metric-val text-muted tabular-nums">{metrics.cancelled}</strong>
          </div>
          <div className="orders-metric-item">
            <span className="metric-label">Cumulative Fill Rate</span>
            <strong className="metric-val tabular-nums">{metrics.overallFillRate}%</strong>
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      {normalizedOrders.length > 0 && (
        <div className="orders-filter-row" role="tablist" aria-label="Filter orders by status">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'ALL'}
            className={`filter-tab ${filterTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterTab('ALL')}
          >
            All Orders ({metrics.total})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'ACTIVE'}
            className={`filter-tab ${filterTab === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setFilterTab('ACTIVE')}
          >
            Active ({metrics.active})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'FILLED'}
            className={`filter-tab ${filterTab === 'FILLED' ? 'active' : ''}`}
            onClick={() => setFilterTab('FILLED')}
          >
            Filled ({metrics.filled})
          </button>
          {metrics.partial > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'PARTIAL'}
              className={`filter-tab ${filterTab === 'PARTIAL' ? 'active' : ''}`}
              onClick={() => setFilterTab('PARTIAL')}
            >
              Partial ({metrics.partial})
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'CANCELLED'}
            className={`filter-tab ${filterTab === 'CANCELLED' ? 'active' : ''}`}
            onClick={() => setFilterTab('CANCELLED')}
          >
            Cancelled ({metrics.cancelled})
          </button>
        </div>
      )}

      {/* ORDERS TABLE */}
      {filteredOrders.length > 0 ? (
        <div className="ui-table-wrap orders-table-wrap">
          <table className="ui-table semantic-table orders-table" aria-label="Placed orders list">
            <thead>
              <tr>
                <th className="text-left">Time</th>
                <th className="text-left">Order ID</th>
                <th className="text-left">Instrument</th>
                <th className="text-center">Side</th>
                <th className="text-left">Type</th>
                <th className="text-right">Execution Progress</th>
                <th className="text-right">Price / Fill</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredOrders].reverse().map((order) => {
                const isBuy = order.side === 'BUY';
                const canCancel =
                  cancelOrder &&
                  (order.rawStatus === 'OPEN' || order.rawStatus === 'PARTIALLY_FILLED');
                const isThisOrderCancelling = cancellingOrderId === order.id;

                const orderDate = new Date(order.timestamp || order.createdAt || Date.now());
                const formattedTime = orderDate.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                const fillClass =
                  order.fillRatio === 100
                    ? 'full'
                    : order.fillRatio > 0
                    ? 'partial'
                    : 'zero';

                return (
                  <tr key={order.id} className={`order-row-item ${isThisOrderCancelling ? 'is-cancelling' : ''}`}>
                    <td className="text-left tabular-nums text-muted text-sm">{formattedTime}</td>
                    <td className="text-left font-mono text-xs">
                      <span className="order-id-chip" title={String(order.id)}>
                        {String(order.id).slice(-8)}
                      </span>
                    </td>
                    <td className="text-left font-medium">
                      <strong className="order-symbol">{order.symbol}</strong>
                    </td>
                    <td className="text-center">
                      <span className={`order-badge ${isBuy ? 'order-badge-buy' : 'order-badge-sell'}`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="text-left text-muted">
                      <span className="order-type-tag">{order.type}</span>
                    </td>
                    <td className="text-right tabular-nums">
                      <div className="fill-ratio-cell">
                        <div className="fill-ratio-numbers">
                          <span>{order.filledQty} / {order.totalQty}</span>
                          <span className="fill-pct text-muted">({order.fillRatio}%)</span>
                        </div>
                        <div className="fill-progress-track" title={`${order.fillRatio}% filled`}>
                          <div
                            className={`fill-progress-bar ${fillClass}`}
                            style={{ width: `${order.fillRatio}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        {getLifecycleExplanation(order)}
                      </div>
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      <div className="order-price-cell">
                        {order.filledQty > 0 ? (
                          <>
                            <strong className="exec-price-text">
                              {formatINR(order.avg_fill_price || order.price || 0)}
                            </strong>
                            {order.type === 'LIMIT' && (
                              <span className="limit-ref-text text-muted text-xs">
                                Limit: {formatINR(order.price || 0)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <strong>
                              {order.type === 'LIMIT' && Number(order.price) > 0 ? formatINR(order.price) : 'Market'}
                            </strong>
                            <span className="not-executed-tag text-muted text-xs">
                              Not executed
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      {getStatusBadge(order)}
                    </td>
                    <td className="text-center">
                      {canCancel ? (
                        <button
                          type="button"
                          className="cancel-order-button"
                          onClick={() => cancelOrder(order)}
                          disabled={Boolean(isThisOrderCancelling || cancellingOrderId)}
                          title={`Cancel resting order ${order.id}`}
                          aria-label={`Cancel order ${order.id}`}
                        >
                          {isThisOrderCancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-panel">
          {orders.length === 0
            ? 'No orders placed yet. Enter an order in the Trade Terminal to begin.'
            : `No orders match filter "${filterTab}".`}
        </div>
      )}
    </section>
  );
}

export default OrdersTable;
