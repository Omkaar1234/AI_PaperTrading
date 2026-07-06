import React from 'react';
import { formatAssetPrice } from '../constants';

function TradeFormCard({
  assetInfo,
  handlePlaceOrder,
  orderType,
  positions,
  selectedAsset,
  setOrderType,
  setTradeMode,
  setTradePrice,
  setTradeQuantity,
  tradeMode,
  tradePrice,
  tradeQuantity,
  user
}) {
  const estimatedPrice = orderType === 'MARKET' ? assetInfo?.currentPrice || 0 : parseFloat(tradePrice || 0);
  const sellableQty = positions.find((position) => position.symbol === selectedAsset?.symbol)?.quantity || 0;
  const notional = estimatedPrice * tradeQuantity;
  const isBuy = tradeMode === 'BUY';
  const maxAffordableQty = estimatedPrice > 0 ? Math.max(1, Math.floor((user?.balance || 0) / estimatedPrice)) : 100;
  const maxQuantity = Math.max(1, isBuy ? Math.min(maxAffordableQty || 1, 1000) : Math.max(sellableQty, 1));
  const orderDisabled = !isBuy && sellableQty < tradeQuantity;

  return (
    <section className="card trade-card floating-ticket">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Execution</p>
          <h3>Order Ticket</h3>
        </div>
        <span className="status-chip">{selectedAsset?.symbol || '--'}</span>
      </div>

      <div className="side-toggle">
        <button className={isBuy ? 'active buy' : ''} onClick={() => setTradeMode('BUY')}>
          Buy
        </button>
        <button className={!isBuy ? 'active sell' : ''} onClick={() => setTradeMode('SELL')}>
          Sell
        </button>
      </div>

      <div className="segment-control two-up">
        <button className={orderType === 'MARKET' ? 'active' : ''} onClick={() => setOrderType('MARKET')}>
          Market
        </button>
        <button className={orderType === 'LIMIT' ? 'active' : ''} onClick={() => setOrderType('LIMIT')}>
          Limit
        </button>
      </div>

      {orderType === 'LIMIT' && (
        <label className="field">
          <span>Limit Price</span>
          <input type="number" step="0.01" value={tradePrice} onChange={(event) => setTradePrice(event.target.value)} />
        </label>
      )}

      <label className="field">
        <span>Quantity</span>
        <input type="number" min="1" value={tradeQuantity} onChange={(event) => setTradeQuantity(parseInt(event.target.value, 10) || 1)} />
      </label>
      <input
        className="quantity-slider"
        type="range"
        min="1"
        max={maxQuantity}
        value={Math.min(tradeQuantity, maxQuantity)}
        onChange={(event) => setTradeQuantity(parseInt(event.target.value, 10) || 1)}
      />

      <div className="summary-grid order-summary-grid">
        <div>
          <span>Price</span>
          <strong>{formatAssetPrice(estimatedPrice, selectedAsset?.assetType)}</strong>
        </div>
        <div>
          <span>Order Value</span>
          <strong>{formatAssetPrice(notional, selectedAsset?.assetType)}</strong>
        </div>
        <div>
          <span>{isBuy ? 'Available Cash' : 'Sellable Qty'}</span>
          <strong>{isBuy ? formatAssetPrice(user?.balance || 0) : `${sellableQty} units`}</strong>
        </div>
      </div>

      <div className="position-snippet">
        <span>Open position in {selectedAsset?.symbol || '--'}</span>
        <strong>{sellableQty} units</strong>
      </div>

      <div className="action-row">
        <button
          className={isBuy ? 'buy-button' : 'sell-button'}
          onClick={() => handlePlaceOrder(tradeMode.toLowerCase())}
          disabled={orderDisabled}
        >
          {tradeMode} {orderType}
        </button>
      </div>
    </section>
  );
}

export default TradeFormCard;
