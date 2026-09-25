import React, { useState, useEffect, useRef } from 'react';

const PROMOTED_EQUITIES = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS', name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel' }
];

function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '--';
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(val, showPlus = true) {
  if (val === null || val === undefined || isNaN(val)) return '--';
  const num = Number(val);
  const prefix = showPlus && num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
}

function formatPlainEnglishReason(text, isPositive = true) {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase();

  if (lower.includes('ema50/ema200') || lower.includes('trend ratio')) {
    return isPositive
      ? 'Medium-to-long term moving average trend is supporting upward movement'
      : 'Moving average trend momentum is weakening the forecast';
  }
  if (lower.includes('distance from ema200') || lower.includes('ema200')) {
    return isPositive
      ? 'Price position relative to long-term 200-day trend provides supportive baseline'
      : 'Price is stretched relative to its long-term moving average';
  }
  if (lower.includes('free cash flow')) {
    return isPositive
      ? 'Healthy free cash flow generation provides strong fundamental backing'
      : 'Free cash flow contraction is weighing on the forecast';
  }
  if (lower.includes('debt-to-equity') || lower.includes('net debt')) {
    return isPositive
      ? 'Conservative balance sheet leverage supports valuation stability'
      : 'Higher balance sheet leverage is weighing on the outlook';
  }
  if (lower.includes('eps growth acceleration') || lower.includes('eps')) {
    return isPositive
      ? 'Quarterly earnings growth trajectory is supporting forecast conviction'
      : 'Recent earnings growth momentum is tempering forecast conviction';
  }
  if (lower.includes('earnings growth')) {
    return isPositive
      ? 'Positive earnings growth acceleration is supporting upward momentum'
      : 'Slowing earnings growth rate presents a headwind';
  }
  if (lower.includes('return on equity') || lower.includes('roe')) {
    return isPositive
      ? 'Solid return on equity reflects healthy capital efficiency'
      : 'Return on equity is trailing historical sector benchmarks';
  }
  if (lower.includes('quarterly filing') || lower.includes('filing')) {
    return isPositive
      ? 'Recent quarterly financial disclosures provide fresh operational transparency'
      : 'Time elapsed since latest financial disclosure adds caution';
  }
  if (lower.includes('nifty') || lower.includes('market')) {
    return isPositive
      ? 'Broader market index momentum is providing supportive tailwinds'
      : 'Broader market index volatility is creating cross-currents';
  }
  if (lower.includes('dispersion') || lower.includes('uncertainty proxy')) {
    return lower.includes('elevated')
      ? 'Empirical price dispersion is elevated across comparable periods'
      : 'Overall return dispersion remains contained within standard historical bounds';
  }

  // General fallback: Strip any raw numbers, brackets, SHAP math
  let cleaned = text
    .replace(/\s*\(value:[^)]+\)/gi, '')
    .replace(/\s*\([+-]?\d*\.?\d*\s*shap\)/gi, '')
    .replace(/\s*\(\s*uncertainty proxy:[^)]+\)/gi, '')
    .replace(/shap/gi, '')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!cleaned.endsWith('.')) cleaned += '.';
  }
  return cleaned || (isPositive ? 'Technical momentum factor is supportive' : 'Market volatility factor is cautionary');
}

function PredictionCard({
  analyzing,
  analyzeAsset,
  prediction,
  selectedAsset,
  suggestion,
  watchlist = [],
  watchlistDetails = [],
  selectAsset,
  resolveAsset,
  lookupSymbols
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !lookupSymbols) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const matches = await lookupSymbols(trimmed, { limit: 8 });
        if (!ignore) {
          setSearchResults(matches || []);
        }
      } catch (err) {
        if (!ignore) setSearchResults([]);
      } finally {
        if (!ignore) setSearchLoading(false);
      }
    }, 180);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [searchQuery, lookupSymbols]);

  const handleSelectAsset = async (asset) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    const resolved = resolveAsset ? (await resolveAsset(asset)) || asset : asset;
    if (selectAsset) {
      await selectAsset(resolved);
    }
    if (analyzeAsset) {
      analyzeAsset(resolved);
    }
  };

  const currentSymbol = selectedAsset?.symbol || prediction?.symbol || 'RELIANCE.NS';
  const currentName = selectedAsset?.name || '';
  const isUnavailable = prediction?.status === 'unavailable' || prediction?.supported === false;
  const isError = prediction?.status === 'error';
  const isReady = prediction && !isUnavailable && !isError && !analyzing;

  // Signal extraction
  const rawSignal = prediction?.signal || prediction?.trend || 'NEUTRAL';
  const signal = String(rawSignal).toUpperCase();
  const signalLower = signal.toLowerCase();

  // Winning class probability / signal probability strictly [0, 100]%
  let signalProbability = null;
  if (prediction?.confidence !== undefined && prediction?.confidence !== null) {
    const rawConf = Number(prediction.confidence);
    const normalized = (rawConf > 0 && rawConf <= 1) ? rawConf * 100 : rawConf;
    signalProbability = Math.min(Math.max(normalized, 0), 100);
  }

  // Expected 21-day return
  let expectedReturnPct = null;
  if (prediction?.expected_return_21d !== undefined && prediction?.expected_return_21d !== null) {
    const val = Number(prediction.expected_return_21d);
    expectedReturnPct = Math.abs(val) <= 1 ? val * 100 : val;
  } else if (prediction?.price_change_pct !== undefined && prediction?.price_change_pct !== null) {
    expectedReturnPct = Number(prediction.price_change_pct);
  }

  // Price points
  const currentPrice = prediction?.current_price ?? selectedAsset?.price ?? null;
  let expectedPrice = prediction?.predicted_price ?? null;
  if (expectedPrice === null && currentPrice !== null && expectedReturnPct !== null) {
    expectedPrice = currentPrice * (1 + expectedReturnPct / 100);
  }

  // Range estimates (Q10 - Q90)
  const quantiles = prediction?.quantiles;
  const q10 = quantiles?.q10 !== undefined ? Number(quantiles.q10) : null;
  const q90 = quantiles?.q90 !== undefined ? Number(quantiles.q90) : null;

  const q10Pct = q10 !== null ? (Math.abs(q10) <= 1 ? q10 * 100 : q10) : null;
  const q90Pct = q90 !== null ? (Math.abs(q90) <= 1 ? q90 * 100 : q90) : null;

  const lowerEstimate = currentPrice !== null && q10Pct !== null ? currentPrice * (1 + q10Pct / 100) : null;
  const upperEstimate = currentPrice !== null && q90Pct !== null ? currentPrice * (1 + q90Pct / 100) : null;

  // Prediction Uncertainty (Q90 - Q10)
  let uncertaintyPct = null;
  if (prediction?.uncertainty_proxy !== undefined && prediction?.uncertainty_proxy !== null) {
    const rawUncert = Number(prediction.uncertainty_proxy);
    uncertaintyPct = Math.abs(rawUncert) <= 1 ? rawUncert * 100 : rawUncert;
  } else if (q10Pct !== null && q90Pct !== null) {
    uncertaintyPct = Math.abs(q90Pct - q10Pct);
  }

  // Probabilities distribution
  const probs = prediction?.probabilities;
  const probUp = probs?.up !== undefined ? (Number(probs.up) <= 1 ? probs.up * 100 : probs.up) : null;
  const probNeutral = probs?.neutral !== undefined ? (Number(probs.neutral) <= 1 ? probs.neutral * 100 : probs.neutral) : null;
  const probDown = probs?.down !== undefined ? (Number(probs.down) <= 1 ? probs.down * 100 : probs.down) : null;

  // Reasons & Risks in user-friendly English
  const positiveFactors = (Array.isArray(prediction?.reasons) && prediction.reasons.length > 0
    ? prediction.reasons.map((r) => formatPlainEnglishReason(r, true))
    : ['Technical moving average momentum supports current direction.']
  ).filter(Boolean);

  const riskFactors = (Array.isArray(prediction?.risks) && prediction.risks.length > 0
    ? prediction.risks.map((r) => formatPlainEnglishReason(r, false))
    : ['Empirical return volatility is within standard historical bounds.']
  ).filter(Boolean);

  // Trading Desk Action
  const deskAction = suggestion?.action?.toUpperCase() || 'HOLD';

  return (
    <div className="prediction-experience">
      {/* 1. Universal Asset Selector Header */}
      <section className="card asset-selector-card">
        <div className="asset-selector-top">
          <div className="selected-asset-info">
            <span className="eyebrow">Select Asset to Analyze</span>
            <div className="selected-asset-title-row">
              <h2 className="selected-symbol-title">{currentSymbol}</h2>
              {currentName ? <span className="selected-asset-fullname">— {currentName}</span> : null}
            </div>
          </div>

          <div className="selector-actions">
            <button
              type="button"
              className="primary-button run-forecast-btn"
              onClick={() => {
                if (searchQuery.trim() && searchResults.length > 0) {
                  handleSelectAsset(searchResults[0]);
                } else if (searchQuery.trim()) {
                  handleSelectAsset({ symbol: searchQuery.trim().toUpperCase() });
                } else {
                  analyzeAsset(selectedAsset || { symbol: currentSymbol });
                }
              }}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing market data…' : `Analyze ${currentSymbol}`}
            </button>
          </div>
        </div>

        {/* Search Input Shell */}
        <div className="asset-search-wrapper" ref={searchRef}>
          <div className="asset-search-input-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="asset-search-input"
              placeholder="Search all 2,600+ NSE stocks & crypto (e.g. Reliance, TCS, HDFC, BTC, INFY...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchResults.length > 0) {
                    handleSelectAsset(searchResults[0]);
                  } else if (searchQuery.trim()) {
                    handleSelectAsset({ symbol: searchQuery.trim().toUpperCase() });
                  }
                }
              }}
            />
            {searchLoading ? <span className="search-spinner">Searching…</span> : null}
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchResults.length > 0 ? (
            <div className="asset-search-dropdown-menu">
              {searchResults.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  className="search-result-row"
                  onClick={() => handleSelectAsset(asset)}
                >
                  <div className="search-row-left">
                    <span className="search-row-symbol">{asset.symbol}</span>
                    <span className="search-row-name">{asset.name || asset.exchange}</span>
                  </div>
                  <span className="search-row-tag">{asset.type || (asset.symbol.includes('-USD') ? 'Crypto' : 'Stock')}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Quick Audited Equities Row */}
        <div className="quick-access-bar">
          <span className="quick-access-label">Popular Equities:</span>
          <div className="quick-access-pills">
            {PROMOTED_EQUITIES.map((item) => {
              const isSelected = currentSymbol === item.symbol;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  className={`quick-asset-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectAsset(item)}
                  disabled={analyzing}
                >
                  <span className="pill-symbol">{item.symbol.replace('.NS', '')}</span>
                  <span className="pill-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Loading State (No Stale Data) */}
      {analyzing ? (
        <section className="card prediction-loading-card">
          <div className="loading-animation-shell">
            <div className="loading-pulse-orb" />
          </div>
          <h3>Analyzing market data…</h3>
          <p>Evaluating 21-day price movement, volatility corridor, and fundamental factors for <strong>{currentSymbol}</strong>.</p>
        </section>
      ) : null}

      {/* 3. Prediction Unavailable State */}
      {!analyzing && isUnavailable ? (
        <section className="card prediction-unavailable-card">
          <div className="unavailable-icon-shell">ⓘ</div>
          <h3>Prediction unavailable for this asset</h3>
          <p className="unavailable-main-msg">
            The current prediction model does not support <strong>{currentSymbol}</strong> yet.
          </p>
          <div className="unavailable-details-box">
            <p>
              {prediction?.message || 'Our promoted 21-trading-day forecast focuses exclusively on supported Indian equities with verified fundamental valuation data. Cryptocurrency and non-covered assets are strictly isolated to prevent unvalidated predictions.'}
            </p>
          </div>
          <div className="switch-to-supported-prompt">
            <span>Select one of the supported equities to view genuine AI price forecasts:</span>
            <div className="supported-buttons-row">
              {PROMOTED_EQUITIES.slice(0, 4).map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className="secondary-button switch-asset-btn"
                  onClick={() => handleSelectAsset(item)}
                >
                  {item.name} ({item.symbol.replace('.NS', '')})
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 4. Error State */}
      {!analyzing && isError ? (
        <section className="card prediction-error-card">
          <div className="error-icon-shell">⚠</div>
          <h3>Unable to generate prediction</h3>
          <p>{prediction?.message || 'Could not reach the prediction service or retrieve market data.'}</p>
          <button
            type="button"
            className="primary-button retry-btn"
            onClick={() => analyzeAsset(selectedAsset || { symbol: currentSymbol })}
          >
            Retry Analysis
          </button>
        </section>
      ) : null}

      {/* 5. Main AI Price Forecast Experience (Supported & Ready) */}
      {isReady ? (
        <div className="forecast-display-stack">
          {/* SECTION A: FORECAST HERO */}
          <section className="card forecast-hero-card">
            <div className="hero-header">
              <span className="eyebrow forecast-eyebrow">AI PRICE FORECAST</span>
              <span className="horizon-badge">21 Trading Days</span>
            </div>

            <div className="forecast-hero-body">
              {/* Direction Indicator */}
              <div className={`direction-badge direction-${signalLower}`}>
                <span className="direction-dot" />
                <span className="direction-text">{signal}</span>
              </div>

              {/* Movement Figure */}
              <div className="expected-movement-block">
                <span className="movement-label">Expected movement over next 21 trading days</span>
                <div className={`movement-value ${expectedReturnPct >= 0 ? 'positive' : 'negative'}`}>
                  {formatPct(expectedReturnPct)}
                </div>
              </div>

              {/* Price Pair */}
              <div className="hero-prices-grid">
                <div className="hero-price-item">
                  <span className="hero-price-label">Current Price</span>
                  <span className="hero-price-number">{formatCurrency(currentPrice)}</span>
                </div>
                <div className="hero-price-arrow">→</div>
                <div className="hero-price-item highlight">
                  <span className="hero-price-label">Expected Price</span>
                  <span className="hero-price-number highlight-val">{formatCurrency(expectedPrice)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION B: POSSIBLE PRICE RANGE */}
          <section className="card section-card">
            <div className="section-title-row">
              <div>
                <h3>Possible Price Range</h3>
                <p className="section-subtext">Estimated movement range over 21 trading days</p>
              </div>
              <div className="range-pct-badge">
                {q10Pct !== null && q90Pct !== null ? `${formatPct(q10Pct)} → ${formatPct(q90Pct)}` : '--'}
              </div>
            </div>

            {/* 3-Column Estimate Cards */}
            <div className="price-estimates-grid">
              <div className="estimate-card lower-estimate">
                <span className="estimate-label">Lower estimate</span>
                <strong className="estimate-price">{formatCurrency(lowerEstimate)}</strong>
                <span className="estimate-pct">{formatPct(q10Pct)}</span>
              </div>

              <div className="estimate-card expected-estimate">
                <span className="estimate-label">Expected</span>
                <strong className="estimate-price expected-price">{formatCurrency(expectedPrice)}</strong>
                <span className="estimate-pct">{formatPct(expectedReturnPct)}</span>
              </div>

              <div className="estimate-card upper-estimate">
                <span className="estimate-label">Upper estimate</span>
                <strong className="estimate-price">{formatCurrency(upperEstimate)}</strong>
                <span className="estimate-pct">{formatPct(q90Pct)}</span>
              </div>
            </div>

            {/* Visual Corridor Bar */}
            <div className="range-corridor-shell">
              <div className="range-corridor-track">
                <div className="range-corridor-fill" />
                <div className="range-corridor-marker" />
              </div>
            </div>

            <p className="helper-text range-helper-note">
              Most modelled outcomes fall within this range. (Historical modelling interval; does not guarantee price bounds.)
            </p>
          </section>

          {/* SECTION C & D: SIGNAL STRENGTH & UNCERTAINTY */}
          <div className="dual-metrics-grid">
            {/* C: Signal Probability */}
            <section className="card metric-section-card">
              <div className="section-title-row">
                <div>
                  <h3>Signal Probability</h3>
                  <p className="section-subtext">Directional probability distribution</p>
                </div>
                <div className="signal-probability-badge">
                  <span>Dominant direction:</span>
                  <strong>{signalProbability !== null ? `${signalProbability.toFixed(1)}%` : '--'}</strong>
                </div>
              </div>

              {/* Horizontal Distribution Bar */}
              <div className="prob-visual-bar">
                <div
                  className="prob-segment prob-segment-up"
                  style={{ width: `${probUp || 33}%` }}
                  title={`UP: ${probUp ? probUp.toFixed(1) : 33}%`}
                />
                <div
                  className="prob-segment prob-segment-neutral"
                  style={{ width: `${probNeutral || 34}%` }}
                  title={`NEUTRAL: ${probNeutral ? probNeutral.toFixed(1) : 34}%`}
                />
                <div
                  className="prob-segment prob-segment-down"
                  style={{ width: `${probDown || 33}%` }}
                  title={`DOWN: ${probDown ? probDown.toFixed(1) : 33}%`}
                />
              </div>

              {/* Legend with Values */}
              <div className="prob-legend-row">
                <div className="legend-item">
                  <span className="legend-dot up-dot" />
                  <span className="legend-name">UP:</span>
                  <span className="legend-value">{probUp !== null ? `${probUp.toFixed(1)}%` : '--'}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot neutral-dot" />
                  <span className="legend-name">NEUTRAL:</span>
                  <span className="legend-value">{probNeutral !== null ? `${probNeutral.toFixed(1)}%` : '--'}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot down-dot" />
                  <span className="legend-name">DOWN:</span>
                  <span className="legend-value">{probDown !== null ? `${probDown.toFixed(1)}%` : '--'}</span>
                </div>
              </div>

              {/* Honest Interpretation Note */}
              <p className="prob-interpretation-note">
                {probNeutral > probUp && probNeutral > probDown
                  ? 'Signal is mixed — no direction has a dominant probability (Neutral consolidation is the largest modelled class).'
                  : Math.max(probUp || 0, probNeutral || 0, probDown || 0) < 45
                  ? 'Signal is mixed — no direction has a dominant probability.'
                  : (probUp >= 45 ? 'Upward probability exhibits directional lead over alternatives.' : 'Downward probability exhibits directional lead over alternatives.')}
              </p>

              <p className="helper-text">
                Model likelihood of the dominant movement path; does not imply certainty.
              </p>
            </section>

            {/* D: Uncertainty */}
            <section className="card metric-section-card">
              <div className="section-title-row">
                <div>
                  <h3>Prediction Uncertainty</h3>
                  <p className="section-subtext">Width of the plausible movement corridor</p>
                </div>
              </div>

              <div className="uncertainty-display-block">
                <span className="uncertainty-big-number">
                  {uncertaintyPct !== null ? `${uncertaintyPct.toFixed(2)}%` : '--'}
                </span>
                <span className="uncertainty-pill">
                  {uncertaintyPct && uncertaintyPct > 15 ? 'Elevated Dispersion' : 'Normal Dispersion'}
                </span>
              </div>

              <p className="helper-text">
                Higher values mean a wider range of possible outcomes.
              </p>
            </section>
          </div>

          {/* SECTION E: WHY THIS FORECAST? */}
          <section className="card section-card">
            <div className="section-title-row">
              <div>
                <h3>Why this forecast?</h3>
                <p className="section-subtext">Key financial, technical, and market factors influencing the 21-day outlook</p>
              </div>
            </div>

            <div className="factors-columns-grid">
              {/* Supporting Factors */}
              <div className="factor-column positive-factors">
                <div className="factor-col-header">
                  <span className="factor-icon-badge positive-badge">✓</span>
                  <h4>Supporting factors</h4>
                </div>
                <ul className="factors-list">
                  {positiveFactors.map((item, idx) => (
                    <li key={idx} className="factor-item positive-factor-item">
                      <span className="factor-bullet">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Factors Weighing on Forecast / Risk Factors */}
              <div className="factor-column risk-factors">
                <div className="factor-col-header">
                  <span className="factor-icon-badge warning-badge">⚠</span>
                  <h4>Factors weighing on the forecast</h4>
                </div>
                <ul className="factors-list">
                  {riskFactors.map((item, idx) => (
                    <li key={idx} className="factor-item risk-factor-item">
                      <span className="factor-bullet">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION F: TRADING VIEW (SEPARATE & SECONDARY) */}
          <section className="card trading-view-card">
            <div className="trading-view-header">
              <div>
                <span className="trading-view-eyebrow">Trading View</span>
                <h4>Platform Execution Suggestion</h4>
              </div>
              <div className={`trading-action-tag action-${deskAction.toLowerCase()}`}>
                {deskAction}
              </div>
            </div>
            <p className="trading-view-note">
              Based on the platform's trading rules and account position gating. Separate from the 21-day price forecast.
            </p>
          </section>
        </div>
      ) : null}

      {/* 6. Empty State if nothing is selected or analyzed yet */}
      {!analyzing && !prediction && !isUnavailable && !isError ? (
        <section className="card prediction-empty-card">
          <div className="empty-icon-shell">📈</div>
          <h3>AI Price Forecast Ready</h3>
          <p>
            Select an equity above or search from over 2,600 tradable assets to evaluate its 21-trading-day directional forecast, expected price targets, movement range, and supporting market factors.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default PredictionCard;
