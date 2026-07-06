const axios = require('axios');
const persistenceService = require('./persistenceService');

const NSE_EQUITY_LIST_URL =
  process.env.NSE_EQUITY_LIST_URL || 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const NSE_SME_LIST_URL =
  process.env.NSE_SME_LIST_URL || 'https://nsearchives.nseindia.com/content/equities/SME_EQUITY_L.csv';
const NSE_NIFTY_100_URL =
  process.env.NSE_NIFTY_100_URL || 'https://nsearchives.nseindia.com/content/indices/ind_nifty100list.csv';
const NSE_NIFTY_MIDCAP_150_URL =
  process.env.NSE_NIFTY_MIDCAP_150_URL || 'https://nsearchives.nseindia.com/content/indices/ind_niftymidcap150list.csv';
const NSE_NIFTY_SMALLCAP_250_URL =
  process.env.NSE_NIFTY_SMALLCAP_250_URL || 'https://nsearchives.nseindia.com/content/indices/ind_niftysmallcap250list.csv';
const COINGECKO_MARKETS_URL =
  process.env.COINGECKO_MARKETS_URL || 'https://api.coingecko.com/api/v3/coins/markets';

const DEFAULT_CRYPTO_PAGE_SIZE = Number(process.env.CRYPTO_SYMBOL_SYNC_LIMIT || 100);

function buildSearchText(parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseCsvLine(line = '') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text = '') {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header.trim()] = columns[index] ?? '';
      return record;
    }, {});
  });
}

async function fetchCsvRows(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/csv,text/plain,*/*'
    }
  });

  return parseCsv(String(data || ''));
}

function pickSymbolField(row = {}) {
  return (
    row.SYMBOL ||
    row.Symbol ||
    row.symbol ||
    row.Identifier ||
    row.IDENTIFIER ||
    ''
  )
    .trim()
    .toUpperCase();
}

async function fetchIndexMembership() {
  const [largeRows, midRows, smallRows] = await Promise.all([
    fetchCsvRows(NSE_NIFTY_100_URL),
    fetchCsvRows(NSE_NIFTY_MIDCAP_150_URL),
    fetchCsvRows(NSE_NIFTY_SMALLCAP_250_URL)
  ]);

  return {
    largeCap: new Set(largeRows.map(pickSymbolField).filter(Boolean)),
    midCap: new Set(midRows.map(pickSymbolField).filter(Boolean)),
    smallCap: new Set(smallRows.map(pickSymbolField).filter(Boolean))
  };
}

function resolveMarketCapCategory(symbol, membership) {
  if (membership.largeCap.has(symbol)) {
    return 'large cap';
  }
  if (membership.midCap.has(symbol)) {
    return 'mid cap';
  }
  if (membership.smallCap.has(symbol)) {
    return 'small cap';
  }
  return 'unclassified';
}

function normalizeNseRow(row, membership) {
  const baseSymbol = pickSymbolField(row);
  const companyName = (row['NAME OF COMPANY'] || row.NAME || row.Company || '').trim();
  const series = (row.SERIES || row.Series || '').trim().toUpperCase();

  if (!baseSymbol || !companyName) {
    return null;
  }

  if (series && !['EQ', 'BE', 'SM'].includes(series)) {
    return null;
  }

  return {
    symbol: `${baseSymbol}.NS`,
    displaySymbol: `${baseSymbol}.NS`,
    baseSymbol,
    providerSymbol: `${baseSymbol}.NS`,
    name: companyName,
    exchange: 'NSE',
    type: 'stock',
    assetType: 'stocks',
    marketCapCategory: resolveMarketCapCategory(baseSymbol, membership),
    currency: 'INR',
    source: 'nse',
    metadata: {
      series: series || null,
      isin: row['ISIN NUMBER'] || null,
      dateOfListing: row['DATE OF LISTING'] || null,
      faceValue: row['FACE VALUE'] || null
    },
    searchText: buildSearchText([baseSymbol, `${baseSymbol}.NS`, companyName, 'nse indian stock equity']),
    lastSyncedAt: new Date()
  };
}

async function syncNseSymbols() {
  const membership = await fetchIndexMembership();
  const [equityRows, smeRows] = await Promise.all([
    fetchCsvRows(NSE_EQUITY_LIST_URL),
    fetchCsvRows(NSE_SME_LIST_URL)
  ]);

  const symbols = [...equityRows, ...smeRows]
    .map((row) => normalizeNseRow(row, membership))
    .filter(Boolean);

  const result = await persistenceService.bulkUpsertSymbols(symbols);
  return {
    fetched: symbols.length,
    ...result
  };
}

function normalizeCryptoCoin(coin = {}) {
  const baseSymbol = String(coin.symbol || '').trim().toUpperCase();
  if (!baseSymbol) {
    return null;
  }

  const symbol = `${baseSymbol}USDT`;
  return {
    symbol,
    displaySymbol: symbol,
    baseSymbol,
    providerSymbol: symbol,
    name: coin.name || baseSymbol,
    exchange: 'BINANCE',
    type: 'crypto',
    assetType: 'crypto',
    marketCapCategory: 'unclassified',
    currency: 'USD',
    source: 'coingecko',
    metadata: {
      coinGeckoId: coin.id || null,
      marketCapRank: coin.market_cap_rank || null,
      image: coin.image || null,
      currentPrice: coin.current_price || null
    },
    searchText: buildSearchText([symbol, baseSymbol, coin.name, 'crypto coin binance usdt']),
    lastSyncedAt: new Date()
  };
}

async function syncCryptoSymbols() {
  const { data } = await axios.get(COINGECKO_MARKETS_URL, {
    timeout: 20000,
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: DEFAULT_CRYPTO_PAGE_SIZE,
      page: 1,
      sparkline: false
    },
    headers: {
      Accept: 'application/json'
    }
  });

  const symbols = Array.isArray(data) ? data.map(normalizeCryptoCoin).filter(Boolean) : [];
  const result = await persistenceService.bulkUpsertSymbols(symbols);

  return {
    fetched: symbols.length,
    ...result
  };
}

async function syncAllSymbols() {
  const [stocks, crypto] = await Promise.all([syncNseSymbols(), syncCryptoSymbols()]);
  return {
    stocks,
    crypto,
    totalFetched: (stocks.fetched || 0) + (crypto.fetched || 0)
  };
}

module.exports = {
  syncAllSymbols,
  syncCryptoSymbols,
  syncNseSymbols
};
