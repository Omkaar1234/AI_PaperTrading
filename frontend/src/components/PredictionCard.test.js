import React from 'react';
import ReactDOMServer from 'react-dom/server';
import PredictionCard from './PredictionCard';

const MOCK_TCS_PREDICTION = {
  asset: "TCS.NS",
  symbol: "TCS.NS",
  signal: "UP",
  trend: "UP",
  confidence: 32.67,
  current_price: 2373,
  predicted_price: 2358.72,
  expected_return_21d: -0.006018808937858156,
  price_change_pct: -0.6,
  probabilities: {
    down: 0.31358118528497997,
    neutral: 0.35974088548038663,
    up: 0.3266779292346333
  },
  quantiles: {
    q10: -0.07327339172662872,
    q50: -0.007130065336937432,
    q90: 0.06856023216226813
  },
  uncertainty_proxy: 0.14183362388889686,
  reasons: [
    "EMA50/EMA200 Trend Ratio (value: -0.13) positively supported UP probability (+0.127 SHAP).",
    "Distance from EMA200 (value: -0.09) positively supported UP probability (+0.039 SHAP).",
    "YoY Free Cash Flow Growth (value: 0.16) positively supported UP probability (+0.013 SHAP)."
  ],
  risks: [
    "Net Debt-to-Equity Ratio (value: -0.14) detracted from signal conviction (-0.148 SHAP).",
    "EPS Growth Acceleration (value: -0.02) detracted from signal conviction (-0.086 SHAP).",
    "Empirical dispersion is contained (uncertainty proxy: 14.2%)."
  ],
  model_version: "uprise-21d-v2.5.0",
  feature_version: "55-pit-technical-fundamental-v2",
  status: "success"
};

const MOCK_RELIANCE_PREDICTION = {
  asset: "RELIANCE.NS",
  symbol: "RELIANCE.NS",
  signal: "UP",
  trend: "UP",
  confidence: 31.83,
  current_price: 1325,
  predicted_price: 1343.23,
  expected_return_21d: 0.013757243516090962,
  price_change_pct: 1.38,
  probabilities: {
    down: 0.3018539922313938,
    neutral: 0.379847912616129,
    up: 0.3182980951524771
  },
  quantiles: {
    q10: -0.05809881270919829,
    q50: 0.010593996781037512,
    q90: 0.08679633962014731
  },
  uncertainty_proxy: 0.1448951523293456,
  reasons: [
    "EMA50/EMA200 Trend Ratio (value: -0.04) positively supported UP probability (+0.101 SHAP)."
  ],
  risks: [
    "EPS Growth Acceleration (value: 0.11) detracted from signal conviction (-0.166 SHAP)."
  ],
  model_version: "uprise-21d-v2.5.0",
  feature_version: "55-pit-technical-fundamental-v2",
  status: "success"
};

const MOCK_BHARTIARTL_PREDICTION = {
  asset: "BHARTIARTL.NS",
  symbol: "BHARTIARTL.NS",
  signal: "UP",
  trend: "UP",
  confidence: 40.7,
  current_price: 1948,
  predicted_price: 1986.77,
  expected_return_21d: 0.01990126517166195,
  price_change_pct: 1.99,
  probabilities: {
    down: 0.1598196576244242,
    neutral: 0.4331889174583704,
    up: 0.4069914249172053
  },
  quantiles: {
    q10: -0.045684807633520265,
    q50: 0.01855468935585986,
    q90: 0.08006473093270063
  },
  uncertainty_proxy: 0.1257495385662209,
  reasons: [
    "Net Debt-to-Equity Ratio (value: 1.70) positively supported UP probability (+0.060 SHAP)."
  ],
  risks: [
    "EPS Growth Acceleration (value: -0.02) detracted from signal conviction (-0.127 SHAP)."
  ],
  model_version: "uprise-21d-v2.5.0",
  feature_version: "55-pit-technical-fundamental-v2",
  status: "success"
};

const MOCK_UNAVAILABLE_BTC = {
  asset: "BTC-USD",
  symbol: "BTC-USD",
  status: "unavailable",
  supported: false,
  message: "Prediction unavailable for BTC-USD. Our 21-day ML model is strictly trained and audited for Indian equities (NSE) with fundamental filings."
};

describe('PredictionCard Component — Phase 5A Final UX', () => {
  test('renders empty state when no prediction is loaded', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={null}
        selectedAsset={{ symbol: 'TCS.NS', name: 'Tata Consultancy Services' }}
        suggestion={null}
      />
    );

    expect(html).toContain('AI Price Forecast Ready');
    expect(html).toContain('Analyze TCS.NS');
    expect(html).toContain('Tata Consultancy Services');
  });

  test('renders complete Phase 5A fields for TCS.NS without technical jargon or broken values', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={MOCK_TCS_PREDICTION}
        selectedAsset={{ symbol: 'TCS.NS', name: 'Tata Consultancy Services' }}
        suggestion={{ action: 'HOLD', reason: 'Holding position' }}
      />
    );

    // 1. Technical ML jargon MUST NOT be in user UI
    expect(html).not.toContain('uprise-21d-v2.5.0');
    expect(html).not.toContain('55-pit-technical-fundamental-v2');
    expect(html).not.toContain('TreeSHAP');
    expect(html).not.toContain('RidgeCV');
    expect(html).not.toContain('LightGBM');

    // 2. Section A: Forecast Hero
    expect(html).toContain('AI PRICE FORECAST');
    expect(html).toContain('21 Trading Days');
    expect(html).toContain('direction-text">UP</span>');
    expect(html).toContain('-0.60%');
    expect(html).toContain('₹2,373.00'); // current price
    expect(html).toContain('₹2,358.72'); // expected price

    // 3. Section B: Possible Price Range (Lower, Expected, Upper)
    expect(html).toContain('Possible Price Range');
    expect(html).toContain('Lower estimate');
    expect(html).toContain('Upper estimate');
    expect(html).toContain('-7.33%');
    expect(html).toContain('+6.86%');

    // 4. Section C: Signal Probability with honest interpretation
    expect(html).toContain('Signal Probability');
    expect(html).toContain('Dominant direction:');
    expect(html).toContain('32.7%'); // Winning class probability
    expect(html).toContain('Signal is mixed — no direction has a dominant probability');
    expect(html).not.toContain('3267%'); // No double-100 multiplication
    expect(html).not.toContain('7265%');

    // 5. Section D: Prediction Uncertainty
    expect(html).toContain('Prediction Uncertainty');
    expect(html).toContain('14.18%');
    expect(html).toContain('Normal Dispersion');

    // 6. Section E: Why this forecast? (Plain English factors without raw SHAP)
    expect(html).toContain('Why this forecast?');
    expect(html).toContain('Supporting factors');
    expect(html).toContain('Factors weighing on the forecast');
    expect(html).toContain('Medium-to-long term moving average trend is supporting upward movement');
    expect(html).toContain('Higher balance sheet leverage is weighing on the outlook');

    // 7. Section F: Secondary Trading View at bottom
    expect(html).toContain('Trading View');
    expect(html).toContain('Platform Execution Suggestion');
    expect(html).toContain('HOLD');

    // 8. No NaN or undefined values
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  test('renders complete Phase 5A fields for RELIANCE.NS', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={MOCK_RELIANCE_PREDICTION}
        selectedAsset={{ symbol: 'RELIANCE.NS', name: 'Reliance Industries' }}
        suggestion={{ action: 'HOLD' }}
      />
    );

    expect(html).toContain('AI PRICE FORECAST');
    expect(html).toContain('+1.38%');
    expect(html).toContain('31.8%');
    expect(html).toContain('14.49%');
    expect(html).toContain('₹1,325.00');
    expect(html).toContain('₹1,343.23');
    expect(html).not.toContain('NaN');
  });

  test('renders complete Phase 5A fields for BHARTIARTL.NS', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={MOCK_BHARTIARTL_PREDICTION}
        selectedAsset={{ symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel' }}
        suggestion={{ action: 'HOLD' }}
      />
    );

    expect(html).toContain('AI PRICE FORECAST');
    expect(html).toContain('+1.99%');
    expect(html).toContain('40.7%');
    expect(html).toContain('12.57%');
    expect(html).toContain('₹1,948.00');
    expect(html).toContain('₹1,986.77');
    expect(html).not.toContain('NaN');
  });

  test('renders honest unavailable state for crypto (BTC-USD)', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={MOCK_UNAVAILABLE_BTC}
        selectedAsset={{ symbol: 'BTC-USD', name: 'Bitcoin' }}
        suggestion={null}
      />
    );

    expect(html).toContain('Prediction unavailable for this asset');
    expect(html).toContain('The current prediction model does not support');
    expect(html).toContain('BTC-USD');
    expect(html).toContain('Select one of the supported equities to view genuine AI price forecasts:');
    expect(html).not.toContain('direction-text');
    expect(html).not.toContain('Possible Price Range');
  });

  test('renders honest unavailable state for unsupported equity (TATAMOTORS.NS)', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={{
          symbol: 'TATAMOTORS.NS',
          status: 'unavailable',
          supported: false,
          signal: 'NEUTRAL',
          message: 'Prediction is not currently supported for this asset. The current prediction model does not support this asset yet.'
        }}
        selectedAsset={{ symbol: 'TATAMOTORS.NS', name: 'Tata Motors Limited' }}
        suggestion={null}
      />
    );

    expect(html).toContain('Prediction unavailable for this asset');
    expect(html).toContain('The current prediction model does not support');
    expect(html).toContain('TATAMOTORS.NS');
    expect(html).not.toContain('AI PRICE FORECAST');
    expect(html).not.toContain('direction-text">UP</span>');
    expect(html).not.toContain('Possible Price Range');
  });

  test('renders loading state without displaying stale predictions', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={true}
        analyzeAsset={() => {}}
        prediction={MOCK_TCS_PREDICTION}
        selectedAsset={{ symbol: 'TCS.NS' }}
        suggestion={null}
      />
    );

    expect(html).toContain('Analyzing market data…');
    expect(html).toContain('Evaluating 21-day price movement');
    // Stale forecast hero must be hidden while analyzing
    expect(html).not.toContain('AI PRICE FORECAST');
  });

  test('renders error state with a retry button', () => {
    const html = ReactDOMServer.renderToString(
      <PredictionCard
        analyzing={false}
        analyzeAsset={() => {}}
        prediction={{ status: 'error', message: 'Network connection timed out' }}
        selectedAsset={{ symbol: 'TCS.NS' }}
        suggestion={null}
      />
    );

    expect(html).toContain('Unable to generate prediction');
    expect(html).toContain('Network connection timed out');
    expect(html).toContain('Retry Analysis');
  });
});
