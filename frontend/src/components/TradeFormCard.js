import React from 'react';
import { formatAssetPrice, formatINR } from '../constants';

function TradeFormCard({
  assetInfo,
  handlePlaceOrder,
  orderType,
  positions = [],
  selectedAsset,
  setOrderType,
  setTradeMode,
  setTradePrice,
  setTradeQuantity,
  tradeMode = 'BUY',
  tradePrice = '',
  tradeQuantity = 1,
  user,
  isSubmittingOrder = false
}) {
  const isBuy = tradeMode.toUpperCase() === 'BUY';
  const isLimit = orderType === 'LIMIT';

  // Live market price check (NEVER use 0 as a fake price fallback)
  const marketPrice = Number(assetInfo?.currentPrice || 0);
  const isMarketPriceValid = marketPrice > 0;
  const limitPriceNum = parseFloat(tradePrice || 0);
  const isLimitPriceValid = limitPriceNum > 0;

  // The estimated reference price for notional calculations
  const referencePrice = isLimit ? limitPriceNum : marketPrice;
  const isReferencePriceValid = referencePrice > 0;

  // Position and balance sizing
  const currentPosition = positions.find((p) => p.symbol === selectedAsset?.symbol);
  const sellableQty = Number(currentPosition?.quantity || 0);
  const cashBalance = Number(user?.balance || 0);

  // Sizing limits
  const maxAffordableQty = isReferencePriceValid ? Math.floor(cashBalance / referencePrice) : 0;
  const maxAvailableSizing = isBuy ? maxAffordableQty : sellableQty;

  const validQty = Math.max(1, parseInt(tradeQuantity, 10) || 1);
  const notional = isReferencePriceValid ? validQty * referencePrice : 0;
  const cashRemaining = cashBalance - notional;
  const positionRemaining = sellableQty - validQty;

  // Validation rules
  const hasCashShortfall = isBuy && isReferencePriceValid && notional > cashBalance;
  const hasPositionShortfall = !isBuy && validQty > sellableQty;
  const isMarketOrderBlocked = !isLimit && !isMarketPriceValid;
  const isLimitOrderBlocked = isLimit && !isLimitPriceValid;

  const isOrderBlocked =
    isSubmittingOrder ||
    hasCashShortfall ||
    hasPositionShortfall ||
    isMarketOrderBlocked ||
    isLimitOrderBlocked ||
    !selectedAsset?.symbol;

  // Quick percentage sizing click handler
  const handleQuickSize = (percentage) => {
    if (maxAvailableSizing <= 0) return;
    const computed = Math.max(1, Math.floor((maxAvailableSizing * percentage) / 100));
    setTradeQuantity(computed);
  };

  const getButtonText = () => {
    if (isSubmittingOrder) return 'Placing Order to Engine...';
    if (!selectedAsset) return 'Select an Asset';
    if (isMarketOrderBlocked) return 'Market Quote Unavailable';
    if (isLimitOrderBlocked) return 'Enter Valid Limit Price';
    if (hasCashShortfall) return `Insufficient Cash (Need ₹${(notional - cashBalance).toFixed(2)})`;
    if (hasPositionShortfall) return `Exceeds Holding (${sellableQty} Available)`;
    return `${isBuy ? 'Buy' : 'Sell'} ${validQty} ${selectedAsset.symbol} (${orderType})`;
  };

  return (
    <section className="card trade-card floating-ticket" aria-label="Trade order ticket">
      {/* TICKET HEADER */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Order Ticket</p>
          <h3 className="ticket-title">Execution Desk</h3>
        </div>
        <div className="ticket-symbol-badge">
          <strong>{selectedAsset?.symbol || '--'}</strong>
          <span className="ticket-market-price tabular-nums text-muted">
            {isMarketPriceValid ? formatAssetPrice(marketPrice, selectedAsset?.assetType) : 'Price Pending'}
          </span>
        </div>
      </div>

      {/* SIDE TOGGLE (BUY / SELL) */}
      <div className="side-toggle" role="group" aria-label="Order side">
        <button
          type="button"
          className={`side-btn ${isBuy ? 'active buy' : ''}`}
          onClick={() => setTradeMode('BUY')}
        >
          Buy / Long
        </button>
        <button
          type="button"
          className={`side-btn ${!isBuy ? 'active sell' : ''}`}
          onClick={() => setTradeMode('SELL')}
        >
          Sell / Short
        </button>
      </div>

      {/* ORDER TYPE SELECTOR (MARKET / LIMIT) */}
      <div className="segment-control two-up" role="group" aria-label="Order type">
        <button
          type="button"
          className={orderType === 'MARKET' ? 'active' : ''}
          onClick={() => setOrderType('MARKET')}
        >
          Market Order
        </button>
        <button
          type="button"
          className={orderType === 'LIMIT' ? 'active' : ''}
          onClick={() => setOrderType('LIMIT')}
        >
          Limit Order
        </button>
      </div>

      {/* ORDER TYPE MECHANICS EXPLANATION */}
      <div className="order-type-guide-box">
        {isLimit ? (
          <p className="guide-note">
            <strong>Limit Order:</strong> Rests in the UPRISE matching engine at your specified price or better. Unfilled quantity waits for a counterparty match. <em>Execution is not guaranteed.</em>
          </p>
        ) : (
          <p className="guide-note">
            <strong>Market Order:</strong> Matches immediately against resting counterparty orders in the book. If liquidity is insufficient, remaining units <em>cancel automatically</em>.
          </p>
        )}
      </div>

      {/* LIMIT PRICE INPUT */}
      {isLimit && (
        <label className="field ticket-field">
          <div className="field-label-row">
            <span>Limit Price</span>
            {isMarketPriceValid && (
              <button
                type="button"
                className="field-hint-btn text-primary"
                onClick={() => setTradePrice(marketPrice.toFixed(2))}
              >
                Use Market (₹{marketPrice.toFixed(2)})
              </button>
            )}
          </div>
          <div className="input-with-affix">
            <span className="affix-prefix">₹</span>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={tradePrice}
              placeholder="0.00"
              onChange={(e) => setTradePrice(e.target.value)}
              aria-label="Limit price in rupees"
            />
          </div>
        </label>
      )}

      {/* QUANTITY INPUT */}
      <label className="field ticket-field">
        <div className="field-label-row">
          <span>Order Quantity</span>
          <span className="text-muted text-xs">
            {isBuy ? `Max Affordable: ${maxAffordableQty}` : `Available to Sell: ${sellableQty}`}
          </span>
        </div>
        <div className="input-with-affix">
          <input
            type="number"
            min="1"
            step="1"
            value={tradeQuantity}
            onChange={(e) => setTradeQuantity(parseInt(e.target.value, 10) || 1)}
            aria-label="Order quantity"
          />
          <span className="affix-suffix">Units</span>
        </div>
      </label>

      {/* QUICK SIZING BUTTONS (25%, 50%, 75%, 100%) */}
      {maxAvailableSizing > 0 && (
        <div className="quick-size-row" role="group" aria-label="Quick position sizing">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              className="quick-size-chip"
              onClick={() => handleQuickSize(pct)}
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          ))}
        </div>
      )}

      {/* ORDER SUMMARY & BUYING POWER GRID */}
      <div className="summary-grid order-summary-grid">
        <div className="summary-item">
          <span className="summary-label">Reference Price</span>
          <strong className="summary-value tabular-nums">
            {isReferencePriceValid ? formatINR(referencePrice) : '—'}
          </strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Order Notional</span>
          <strong className="summary-value tabular-nums">
            {isReferencePriceValid ? formatINR(notional) : '—'}
          </strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">{isBuy ? 'Available Cash' : 'Current Holding'}</span>
          <strong className="summary-value tabular-nums">
            {isBuy ? formatINR(cashBalance) : `${sellableQty} units`}
          </strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">{isBuy ? 'Cash After Order' : 'Holding After Order'}</span>
          <strong
            className={`summary-value tabular-nums ${
              (isBuy ? cashRemaining < 0 : positionRemaining < 0) ? 'text-negative' : 'text-muted'
            }`}
          >
            {isBuy
              ? isReferencePriceValid
                ? formatINR(Math.max(0, cashRemaining))
                : formatINR(cashBalance)
              : `${Math.max(0, positionRemaining)} units`}
          </strong>
        </div>
      </div>

      {/* SHORTFALL / INSUFFICIENT LIQUIDITY WARNING */}
      {hasCashShortfall && (
        <div className="ticket-warning-alert" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>Order notional of ₹{notional.toFixed(2)} exceeds available capital of ₹{cashBalance.toFixed(2)}.</span>
        </div>
      )}

      {hasPositionShortfall && (
        <div className="ticket-warning-alert" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>Sell quantity ({validQty}) exceeds your current holding of {sellableQty} units.</span>
        </div>
      )}

      {/* ACTION ROW / SUBMIT BUTTON */}
      <div className="action-row">
        <button
          type="button"
          className={`ticket-submit-button ${isBuy ? 'buy-button' : 'sell-button'} ${
            isSubmittingOrder ? 'loading' : ''
          }`}
          onClick={() => handlePlaceOrder(tradeMode.toLowerCase())}
          disabled={isOrderBlocked}
          aria-busy={isSubmittingOrder}
        >
          {isSubmittingOrder && <span className="btn-spinner" aria-hidden="true" />}
          <span>{getButtonText()}</span>
        </button>
      </div>
    </section>
  );
}

export default TradeFormCard;
