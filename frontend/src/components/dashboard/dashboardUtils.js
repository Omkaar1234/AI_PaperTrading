import { ASSET_TYPES } from '../../constants';

export function getQuoteChangePercent(quote = {}) {
  if (Number(quote.changePercent)) {
    return Number(quote.changePercent);
  }

  if (quote.previousClose) {
    return (Number(quote.change || 0) / Number(quote.previousClose || 1)) * 100;
  }

  return 0;
}

export function getPositionMarketValue(position = {}, quote) {
  const livePrice = Number(quote?.price || position.marketPrice || position.avgPrice || 0);
  return Number(position.quantity || 0) * livePrice;
}

export function getInvestedAmount(positions = []) {
  return positions.reduce((sum, position) => sum + Number(position.invested || 0), 0);
}

export function getUnrealizedPnl(positions = [], marketQuotes = {}) {
  return positions.reduce((sum, position) => {
    const marketValue = getPositionMarketValue(position, marketQuotes[position.symbol]);
    const cost = Number(position.invested || Number(position.quantity || 0) * Number(position.avgPrice || 0));
    return sum + marketValue - cost;
  }, 0);
}

export function getOpenOrders(orders = []) {
  return orders.filter((order) => ['OPEN', 'PARTIALLY_FILLED'].includes(order.status)).length;
}

export function getExecutedOrders(orders = []) {
  return orders.filter((order) => ['FILLED', 'EXECUTED'].includes(order.status)).length;
}

export function getMarketSession(now = new Date()) {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
  return open ? 'Market Open' : 'Market Closed';
}

export function buildSparkline(seed = 1, length = 10) {
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.9) * 7;
    const drift = (index - length / 2) * (seed % 2 ? 1.2 : -0.9);
    return Math.round(50 + wave + drift + (seed % 5) * 2);
  });
}

export function getAssetTypeLabel(assetType) {
  if (assetType === ASSET_TYPES.CRYPTO) {
    return 'Crypto';
  }
  if (assetType === ASSET_TYPES.FOREX) {
    return 'Currency';
  }
  return 'Equity';
}
