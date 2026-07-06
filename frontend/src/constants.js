export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const ASSET_TYPES = {
  STOCKS: 'stocks',
  CRYPTO: 'crypto',
  FOREX: 'forex'
};

export function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatUSD(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatAssetPrice(value, assetType = ASSET_TYPES.STOCKS) {
  return assetType === ASSET_TYPES.CRYPTO ? formatUSD(value) : formatINR(value);
}

export function isAllowedSymbol(symbol = '') {
  return Boolean(String(symbol || '').trim());
}

export function getAssetIcon(type) {
  switch (type) {
    case ASSET_TYPES.CRYPTO:
      return 'BTC';
    case ASSET_TYPES.FOREX:
      return 'FX';
    default:
      return 'EQ';
  }
}
