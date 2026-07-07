export const SECTORS = [
  'Banking',
  'IT',
  'Pharma',
  'FMCG',
  'Auto',
  'Energy',
  'Metals',
  'Realty',
  'Telecom',
  'PSU',
  'Financial Services',
  'Others'
];

export const CAP_FILTERS = [
  { label: 'All Caps', value: 'all' },
  { label: 'Large Cap', value: 'large cap' },
  { label: 'Mid Cap', value: 'mid cap' },
  { label: 'Small Cap', value: 'small cap' }
];

export const CHANGE_FILTERS = [
  { label: 'All Stocks', value: 'all' },
  { label: 'Top Gainers', value: 'gainers' },
  { label: 'Top Losers', value: 'losers' },
  { label: 'Most Active', value: 'active' }
];

export const SORT_OPTIONS = [
  { label: 'Alphabetical', value: 'name' },
  { label: 'Market Cap', value: 'marketCap' },
  { label: 'Volume', value: 'volume' },
  { label: 'Price', value: 'price' },
  { label: '% Change', value: 'changePercent' }
];

export const NSE_SUFFIX = '.NS';

export const INDIAN_FALLBACK_STOCKS = [
  { symbol: 'RELIANCE.NS', baseSymbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', exchange: 'NSE', price: 2868.45, change: 31.2, changePercent: 1.1, volume: 6812400, marketCapCategory: 'large cap' },
  { symbol: 'TCS.NS', baseSymbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', exchange: 'NSE', price: 4014.8, change: -22.6, changePercent: -0.56, volume: 2198700, marketCapCategory: 'large cap' },
  { symbol: 'HDFCBANK.NS', baseSymbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', exchange: 'NSE', price: 1669.35, change: 13.45, changePercent: 0.81, volume: 11238400, marketCapCategory: 'large cap' },
  { symbol: 'INFY.NS', baseSymbol: 'INFY', name: 'Infosys', sector: 'IT', exchange: 'NSE', price: 1518.55, change: 18.9, changePercent: 1.26, volume: 7452100, marketCapCategory: 'large cap' },
  { symbol: 'ICICIBANK.NS', baseSymbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', exchange: 'NSE', price: 1124.7, change: -8.65, changePercent: -0.76, volume: 9276400, marketCapCategory: 'large cap' },
  { symbol: 'SBIN.NS', baseSymbol: 'SBIN', name: 'State Bank of India', sector: 'PSU', exchange: 'NSE', price: 842.15, change: 12.1, changePercent: 1.46, volume: 15824600, marketCapCategory: 'large cap' },
  { symbol: 'BHARTIARTL.NS', baseSymbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', exchange: 'NSE', price: 1426.2, change: 9.55, changePercent: 0.67, volume: 3865400, marketCapCategory: 'large cap' },
  { symbol: 'LT.NS', baseSymbol: 'LT', name: 'Larsen & Toubro', sector: 'Others', exchange: 'NSE', price: 3632.75, change: -41.4, changePercent: -1.13, volume: 1843200, marketCapCategory: 'large cap' },
  { symbol: 'SUNPHARMA.NS', baseSymbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Pharma', exchange: 'NSE', price: 1594.1, change: 24.5, changePercent: 1.56, volume: 2914400, marketCapCategory: 'large cap' },
  { symbol: 'MARUTI.NS', baseSymbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', exchange: 'NSE', price: 12184.3, change: -94.25, changePercent: -0.77, volume: 482100, marketCapCategory: 'large cap' },
  { symbol: 'TITAN.NS', baseSymbol: 'TITAN', name: 'Titan Company', sector: 'FMCG', exchange: 'NSE', price: 3288.95, change: 36.2, changePercent: 1.11, volume: 1379800, marketCapCategory: 'large cap' },
  { symbol: 'JSWSTEEL.NS', baseSymbol: 'JSWSTEEL', name: 'JSW Steel', sector: 'Metals', exchange: 'NSE', price: 928.4, change: -17.05, changePercent: -1.8, volume: 5142600, marketCapCategory: 'large cap' },
  { symbol: 'DLF.NS', baseSymbol: 'DLF', name: 'DLF', sector: 'Realty', exchange: 'NSE', price: 829.75, change: 19.6, changePercent: 2.42, volume: 6218400, marketCapCategory: 'large cap' },
  { symbol: 'BAJFINANCE.NS', baseSymbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Financial Services', exchange: 'NSE', price: 7224.5, change: 62.3, changePercent: 0.87, volume: 943600, marketCapCategory: 'large cap' },
  { symbol: 'PIDILITIND.NS', baseSymbol: 'PIDILITIND', name: 'Pidilite Industries', sector: 'FMCG', exchange: 'NSE', price: 3076.85, change: -28.4, changePercent: -0.91, volume: 364800, marketCapCategory: 'mid cap' },
  { symbol: 'AUBANK.NS', baseSymbol: 'AUBANK', name: 'AU Small Finance Bank', sector: 'Banking', exchange: 'NSE', price: 642.3, change: 7.8, changePercent: 1.23, volume: 2491600, marketCapCategory: 'mid cap' }
];

export function inferSector(asset = {}) {
  const text = `${asset.sector || ''} ${asset.name || ''} ${asset.symbol || ''}`.toLowerCase();
  if (/bank|hdfc|icici|axis|sbi|kotak|federal|indusind/.test(text)) return 'Banking';
  if (/tcs|infosys|infy|wipro|tech|hcl|ltim|mindtree|persistent|oracle/.test(text)) return 'IT';
  if (/pharma|dr|sun|cipla|lupin|biocon|glenmark|zydus|divi/.test(text)) return 'Pharma';
  if (/hindustan|nestle|britannia|dabur|marico|fmcg|itc|godrej/.test(text)) return 'FMCG';
  if (/auto|motor|tata|maruti|mahindra|eicher|bajaj|hero|ashok/.test(text)) return 'Auto';
  if (/reliance|ongc|oil|power|ntpc|coal|adani green|energy|gas/.test(text)) return 'Energy';
  if (/steel|metal|hindalco|vedanta|jsw|sail|tata steel|coal/.test(text)) return 'Metals';
  if (/realty|dlf|lodha|prestige|phoenix|brigade|sobha/.test(text)) return 'Realty';
  if (/telecom|bharti|airtel|idea|vodafone|indus tower/.test(text)) return 'Telecom';
  if (/psu|sbi|pnb|bel|bhel|ioc|bpcl|hpcl|irctc|rail/.test(text)) return 'PSU';
  if (/finance|financial|bajaj fin|chola|muthoot|lic|hdfc life|sbi life/.test(text)) return 'Financial Services';
  return 'Others';
}

export function normalizeIndianStock(asset = {}) {
  const price = Number(asset.price || asset.livePrice || 0);
  const change = Number(asset.change || 0);
  const previousCloseSeed = Number(asset.previousClose || (price - change) || price || 0);
  const changePercent = Number(asset.changePercent || (previousCloseSeed ? (change / previousCloseSeed) * 100 : 0));
  const previousClose = Number(asset.previousClose || (price - change) || price || 0);
  const volatility = Math.max(0.012, Math.abs(changePercent) / 100 + 0.009);
  const sector = SECTORS.includes(asset.sector) ? asset.sector : inferSector(asset);
  const marketCapSeed = Math.max(1, price * (asset.marketCapCategory === 'large cap' ? 120000000 : asset.marketCapCategory === 'mid cap' ? 36000000 : 9000000));
  const symbol = normalizeIndianSymbol(asset.symbol || asset.baseSymbol || '');

  return {
    ...asset,
    symbol,
    baseSymbol: String(asset.baseSymbol || symbol.replace(NSE_SUFFIX, '')).toUpperCase(),
    exchange: asset.exchange || 'NSE',
    type: 'stock',
    assetType: 'stocks',
    sector,
    price,
    change,
    changePercent,
    previousClose,
    open: Number(asset.open || previousClose * (1 + changePercent / 420)),
    high: Number(asset.high || price * (1 + volatility)),
    low: Number(asset.low || price * (1 - volatility)),
    weekHigh52: Number(asset.weekHigh52 || price * (1.18 + volatility)),
    weekLow52: Number(asset.weekLow52 || Math.max(1, price * (0.78 - volatility / 2))),
    marketCap: Number(asset.marketCap || asset.metadata?.marketCap || marketCapSeed),
    peRatio: Number(asset.peRatio || asset.metadata?.peRatio || (18 + (asset.symbol || '').length * 1.7)),
    logoText: String(asset.baseSymbol || symbol || 'EQ').replace(NSE_SUFFIX, '').slice(0, 2).toUpperCase()
  };
}

export function isIndianListedStock(asset = {}) {
  const exchange = String(asset.exchange || '').toUpperCase();
  const type = String(asset.type || '').toLowerCase();
  const symbol = String(asset.symbol || '');
  return type !== 'crypto' &&
    !symbol.includes('-USD') &&
    !symbol.endsWith('=X') &&
    (!exchange || ['NSE', 'BSE'].includes(exchange) || symbol.endsWith(NSE_SUFFIX) || symbol.endsWith('.BO'));
}

export function normalizeIndianSymbol(symbol = '') {
  const cleaned = String(symbol || '').trim().toUpperCase();
  if (!cleaned) return '';
  if (cleaned.endsWith('.NS') || cleaned.endsWith('.BO')) return cleaned;
  return `${cleaned}${NSE_SUFFIX}`;
}

export function getMarketCapBucket(stock = {}) {
  const category = String(stock.marketCapCategory || '').toLowerCase();
  if (category.includes('large')) return 'large cap';
  if (category.includes('mid')) return 'mid cap';
  if (category.includes('small')) return 'small cap';
  const crore = Number(stock.marketCap || 0) / 10000000;
  if (crore >= 20000) return 'large cap';
  if (crore >= 5000) return 'mid cap';
  return 'small cap';
}

export function getStockSearchText(stock = {}) {
  return `${stock.name || ''} ${stock.symbol || ''} ${stock.baseSymbol || ''} ${stock.sector || ''}`.toLowerCase();
}

export function buildMarketCandles(price = 100, changePercent = 0, count = 24) {
  return Array.from({ length: count }, (_, index) => {
    const drift = (index - count / 2) * (changePercent / 100) * price * 0.08;
    const wave = Math.sin(index * 0.8) * price * 0.008;
    const close = Math.max(1, price + drift + wave);
    const open = Math.max(1, close - Math.sin(index + 1) * price * 0.006);
    return {
      open,
      close,
      high: Math.max(open, close) * 1.006,
      low: Math.min(open, close) * 0.994,
      volume: Math.round(200000 + Math.abs(Math.sin(index)) * 900000)
    };
  });
}

export function formatMarketCap(value = 0) {
  const crore = Number(value || 0) / 10000000;
  if (crore >= 100000) return `₹${(crore / 100000).toFixed(2)}L Cr`;
  if (crore >= 1000) return `₹${(crore / 1000).toFixed(2)}K Cr`;
  return `₹${crore.toFixed(0)} Cr`;
}
