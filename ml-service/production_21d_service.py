"""
UPRISE ML V2 — Phase 5A
Production-Safe 21-Day ML Prediction & Portfolio Recommendation Engine

Integrates validated research models:
- Base LightGBM 3-Class Classifier (Directional signal & conviction)
- RidgeCV Regressor (Cross-sectional ranking only)
- Quantile Regressors Q10 / Q50 / Q90 (Uncertainty / dispersion proxy)
- Deterministic TreeSHAP & Ridge Linear Attributions (Explainability)
- Phase 4F Strategy C Portfolio Recommendation (High conviction gating, Ridge rank, Top-3, 35% cap, cash defense)

Strict Safety Rules:
- STRICTLY READ-ONLY / ANALYTICAL: Absolutely zero order placement, zero matching engine interaction, zero account mutations.
- BTC ISOLATION: BTC-USD is strictly isolated. Fundamental valuation model is restricted to Indian equities.
- REJECTED STRATEGY B: Strategy B score-gating and experimental meta-models are strictly excluded.
"""

import lightgbm  # Must be imported before sklearn/scipy on Windows
import os
import sys
import json
import hashlib
import pickle
import logging
import numpy as np
import pandas as pd

# Ensure sys.path includes ml-service, research_21d, and phase_5b
current_dir = os.path.dirname(os.path.abspath(__file__))
research_dir = os.path.join(current_dir, 'research_21d')
phase_5b_dir = os.path.join(research_dir, 'phase_5b')
for p in [current_dir, research_dir, phase_5b_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

logger = logging.getLogger(__name__)

# Canonical promoted constants
EXPECTED_SHA256 = "acbb52c0639ba8eb52e8b79573fcc2b37bf38386cc46822a75de118e3d16f09c"
EXPECTED_BROAD_SHA256 = "e52a72d9d7804b9e6e77881dadc79565e8d5c009c0e7add41e6e195a6f2a549a"
MODEL_VERSION = "uprise-21d-v2.5.0"
MODEL_VERSION_BROAD = "uprise-21d-broad-v1.0.0"
FEATURE_VERSION = "55-pit-technical-fundamental-v2"
FEATURE_VERSION_BROAD = "uprise-broad-tech-v1.0.0"
PORTFOLIO_STRATEGY_VERSION = "v2.5.0-phase4f-strategy-c"

EQUITY_UNIVERSE = [
    'RELIANCE.NS',
    'TCS.NS',
    'INFY.NS',
    'HDFCBANK.NS',
    'ICICIBANK.NS',
    'LT.NS',
    'BHARTIARTL.NS'
]
CRYPTO_UNIVERSE = ['BTC-USD']

# Import Phase 5B broad components
try:
    from features_broad import extract_broad_features, validate_features, FoldPreprocessor
    from explain_broad import BroadExplainer
except ImportError:
    from research_21d.phase_5b.features_broad import extract_broad_features, validate_features, FoldPreprocessor
    from research_21d.phase_5b.explain_broad import BroadExplainer

try:
    from data_pipeline import fetch_yahoo_chart
except ImportError:
    fetch_yahoo_chart = None

# Import explainability engine from audit_4e3
try:
    from audit_4e3.explain_predictions import QuantitativeExplainer, FEATURE_METADATA
except ImportError:
    from research_21d.audit_4e3.explain_predictions import QuantitativeExplainer, FEATURE_METADATA

# Import position sizing from phase_4f
try:
    from phase_4f.position_sizing import compute_position_weights
except ImportError:
    from research_21d.phase_4f.position_sizing import compute_position_weights

try:
    from dataset_21d import load_and_build_21d_dataset
except ImportError:
    from research_21d.dataset_21d import load_and_build_21d_dataset


class Production21dService:
    """
    Production-safe inference and portfolio recommendation engine for UPRISE 21-Day predictions.
    """

    def __init__(self, models_path=None):
        if models_path is None:
            models_path = os.path.join(research_dir, 'models', 'hybrid21d_models.pkl')
        self.models_path = models_path

        self.clf = None
        self.ridge = None
        self.scaler = None
        self.imputer = None
        self.lgbm_mean = None
        self.lgbm_q10 = None
        self.lgbm_q50 = None
        self.lgbm_q90 = None
        self.cols_55 = None
        self.explainer = None
        self.is_loaded = False

        # Phase 5B Broad Equity attributes
        self.broad_models_path = os.path.join(phase_5b_dir, 'models', 'broad21d_models.pkl')
        self.broad_clf = None
        self.broad_ridge = None
        self.broad_preprocessor = None
        self.broad_q10 = None
        self.broad_q50 = None
        self.broad_q90 = None
        self.broad_feature_names = None
        self.broad_explainer = None
        self.is_broad_loaded = False

        # Caches
        self.cached_full_df = None
        self.cached_valid_df = None
        self.cached_nifty = None
        self.cached_vix = None
        self.cached_stock_data = {}

        self.load_and_verify_models()

    def load_and_verify_models(self):
        """
        Loads and cryptographically verifies promoted research model artifacts.
        Rejects unvalidated components (Strategy B, stacking meta-models).
        """
        if not os.path.exists(self.models_path):
            logger.error(f"Promoted model file not found at {self.models_path}")
            self.is_loaded = False
            return False

        # Cryptographic verification for Phase 5A promoted models
        with open(self.models_path, 'rb') as f:
            raw_bytes = f.read()

        computed_sha = hashlib.sha256(raw_bytes).hexdigest()
        if computed_sha != EXPECTED_SHA256:
            msg = f"Cryptographic hash mismatch for promoted models! Expected {EXPECTED_SHA256}, got {computed_sha}"
            logger.critical(msg)
            raise ValueError(msg)

        models_dict = pickle.loads(raw_bytes)

        # Verify exact 55 feature specification
        self.cols_55 = models_dict['cols_55']
        if len(self.cols_55) != 55:
            msg = f"Feature count discrepancy! Expected exactly 55 features, found {len(self.cols_55)}"
            logger.critical(msg)
            raise ValueError(msg)

        # Promote ONLY explicitly validated base estimators
        self.clf = models_dict['clf_base']
        self.ridge = models_dict['ridge_base']
        self.scaler = models_dict['scaler_base']
        self.imputer = models_dict['imputer_base']
        self.lgbm_mean = models_dict['lgbm_mean_base']
        self.lgbm_q10 = models_dict['lgbm_q10_base']
        self.lgbm_q50 = models_dict['lgbm_q50_base']
        self.lgbm_q90 = models_dict['lgbm_q90_base']

        # Build explainability wrapper
        config_wrapper = {'features': self.cols_55, 'strat_b_thresholds': {'tau_up': 0.0, 'tau_dn': 0.0}}
        self.explainer = QuantitativeExplainer(models_dict, config_wrapper)

        self.is_loaded = True
        logger.info(f"Production21dService successfully loaded and verified promoted models (SHA-256: {computed_sha[:12]}...).")

        # Phase 5B Broad Indian Equity Models Loading & Verification
        if os.path.exists(self.broad_models_path):
            with open(self.broad_models_path, 'rb') as f:
                broad_bytes = f.read()

            computed_broad_sha = hashlib.sha256(broad_bytes).hexdigest()
            if computed_broad_sha != EXPECTED_BROAD_SHA256:
                msg = f"Cryptographic hash mismatch for Phase 5B broad models! Expected {EXPECTED_BROAD_SHA256}, got {computed_broad_sha}"
                logger.critical(msg)
                raise ValueError(msg)

            broad_dict = pickle.loads(broad_bytes)
            self.broad_feature_names = broad_dict['feature_names']
            if len(self.broad_feature_names) != 44:
                msg = f"Feature count discrepancy for Broad model! Expected 44, got {len(self.broad_feature_names)}"
                logger.critical(msg)
                raise ValueError(msg)

            self.broad_clf = broad_dict['classifier']
            self.broad_ridge = broad_dict['ranker_ridge']
            self.broad_preprocessor = broad_dict['preprocessor']
            self.broad_q10 = broad_dict['quantile_q10']
            self.broad_q50 = broad_dict['quantile_q50']
            self.broad_q90 = broad_dict['quantile_q90']
            self.broad_explainer = BroadExplainer(self.broad_clf, self.broad_feature_names)
            self.is_broad_loaded = True
            logger.info(f"Production21dService successfully loaded and verified Phase 5B broad models (SHA-256: {computed_broad_sha[:12]}...).")
        else:
            logger.warning(f"Phase 5B broad model file not found at {self.broad_models_path}")
            self.is_broad_loaded = False

        return True

    def _get_benchmark_data(self):
        """Loads or fetches benchmark NIFTY 50 and INDIA VIX series."""
        if self.cached_nifty is None or self.cached_vix is None:
            nifty_path = os.path.join(phase_5b_dir, 'data', 'NSEI_5y.pkl')
            vix_path = os.path.join(phase_5b_dir, 'data', 'INDIAVIX_5y.pkl')
            if os.path.exists(nifty_path) and os.path.exists(vix_path):
                self.cached_nifty = pd.read_pickle(nifty_path)
                self.cached_vix = pd.read_pickle(vix_path)
            elif fetch_yahoo_chart:
                self.cached_nifty = fetch_yahoo_chart('^NSEI', range_str='5y')
                self.cached_vix = fetch_yahoo_chart('^INDIAVIX', range_str='5y')
        return self.cached_nifty, self.cached_vix

    def _get_stock_history(self, symbol: str) -> pd.DataFrame:
        """Retrieves 5-year daily OHLCV from cache or fetches live via Yahoo Chart API."""
        clean_sym = symbol.strip().upper()
        if clean_sym in self.cached_stock_data:
            return self.cached_stock_data[clean_sym]

        slug = clean_sym.replace('.', '_').replace('^', '').replace('-', '_')
        pkl_path = os.path.join(phase_5b_dir, 'data', f"{slug}_5y.pkl")
        if os.path.exists(pkl_path):
            try:
                df = pd.read_pickle(pkl_path)
                if isinstance(df, pd.DataFrame) and not df.empty:
                    self.cached_stock_data[clean_sym] = df
                    return df
            except Exception as e:
                logger.warning(f"Error reading cached pkl for {clean_sym}: {e}")

        if fetch_yahoo_chart:
            df = fetch_yahoo_chart(clean_sym, range_str='5y')
            if not df.empty:
                self.cached_stock_data[clean_sym] = df
                return df
        return pd.DataFrame()

    def _get_dataset(self):
        """Lazy-loads the verified historical dataset for point-in-time features."""
        if self.cached_valid_df is None:
            full_df, valid_df, _ = load_and_build_21d_dataset()
            self.cached_full_df = full_df
            self.cached_valid_df = valid_df
        return self.cached_valid_df

    def get_latest_feature_vector(self, symbol, as_of_date=None):
        """
        Retrieves the exact 55-element feature vector for a symbol as of a given date (or latest).
        """
        clean_sym = symbol.strip().upper()
        df = self._get_dataset()
        sub = df[df['symbol'] == clean_sym]

        if sub.empty:
            raise ValueError(f"No point-in-time market data available for symbol: {clean_sym}")

        if as_of_date:
            target_ts = pd.to_datetime(as_of_date)
            sub = sub[sub.index <= target_ts]
            if sub.empty:
                raise ValueError(f"No market data available for {clean_sym} prior to {as_of_date}")

        latest_row = sub.iloc[-1]
        record_date = str(sub.index[-1].date())
        current_price = float(latest_row['Close'])

        # Validate feature columns exactly matching research schema
        feat_vals = []
        for col in self.cols_55:
            val = latest_row.get(col, np.nan)
            if pd.isna(val) or (isinstance(val, (int, float)) and np.isinf(val)):
                feat_vals.append(np.nan)
            else:
                feat_vals.append(float(val))

        feat_vector = np.array(feat_vals, dtype=np.float64)
        assert len(feat_vector) == 55, f"Feature vector must have exactly 55 entries, got {len(feat_vector)}"

        return feat_vector, record_date, current_price

    def predict_single_asset(self, symbol, as_of_date=None, ranking_context=None):
        """
        Generates a production-safe 21-day prediction for a single asset.
        """
        if not self.is_loaded:
            self.load_and_verify_models()

        clean_sym = symbol.strip().upper()

        # Crypto Pathway: Strictly isolated
        if clean_sym in CRYPTO_UNIVERSE or 'BTC' in clean_sym or clean_sym.endswith('-USD'):
            return {
                "asset": clean_sym,
                "asset_class": "crypto",
                "status": "unavailable",
                "signal": "NEUTRAL",
                "probabilities": {"down": 0.0, "neutral": 1.0, "up": 0.0},
                "expected_return_21d": 0.0,
                "quantiles": {"q10": 0.0, "q50": 0.0, "q90": 0.0},
                "uncertainty_proxy": 0.0,
                "rank": 0,
                "eligible": false if False else False,
                "portfolio_weight": 0.0,
                "reasons": [],
                "risks": [
                    "21D prediction unavailable for cryptocurrency.",
                    "The validated Phase 4E-3 / Phase 4F model is an equity-valuation architecture trained exclusively on Indian equities.",
                    "BTC-USD is strictly isolated to prevent unvalidated feature projection."
                ],
                "message": "BTC-USD prediction unavailable under 21D equity-valuation model.",
                "model_version": MODEL_VERSION,
                "feature_version": FEATURE_VERSION,
                "portfolio_strategy_version": PORTFOLIO_STRATEGY_VERSION,
                "trend": "NEUTRAL",
                "confidence": 0.0,
                "symbol": clean_sym
            }

        # Pathway 1: Phase 5A Promoted 7-Stock Equity Pipeline (55 Features)
        if clean_sym in EQUITY_UNIVERSE:
            feat_vector, record_date, current_price = self.get_latest_feature_vector(clean_sym, as_of_date=as_of_date)
            X_mat = np.ascontiguousarray([feat_vector], dtype=np.float64)

            # 1. Base Classifier Probabilities
            probs = self.clf.predict_proba(X_mat)[0]
            p_down = float(probs[0])
            p_neutral = float(probs[1])
            p_up = float(probs[2])

            # Directional Signal: Directional preference between UP and DOWN
            if p_up > p_down:
                signal = "UP"
                winning_dir_prob = p_up
                target_c_idx = 2
            elif p_down > p_up:
                signal = "DOWN"
                winning_dir_prob = p_down
                target_c_idx = 0
            else:
                signal = "NEUTRAL"
                winning_dir_prob = p_neutral
                target_c_idx = 1

            # 2. Ridge Expected Return (for cross-sectional ranking)
            X_df = pd.DataFrame(X_mat, columns=self.cols_55)
            X_scl = self.scaler.transform(self.imputer.transform(X_df))
            exp_r21_ridge = float(self.ridge.predict(X_scl)[0])

            # LightGBM Mean return
            exp_r21_lgbm = float(self.lgbm_mean.predict(X_mat)[0])

            # 3. Quantile Dispersion (Uncertainty Proxy)
            q10 = float(self.lgbm_q10.predict(X_mat)[0])
            q50 = float(self.lgbm_q50.predict(X_mat)[0])
            q90 = float(self.lgbm_q90.predict(X_mat)[0])

            # Monotonicity guardrail
            if q10 > q90:
                q10, q90 = q90, q10

            uncertainty_proxy = float(q90 - q10)

            # 4. Deterministic Explainability (TreeSHAP for Classifier, Linear for Ridge)
            single_df = pd.DataFrame([feat_vector], columns=self.cols_55)
            raw_clf_contrib = self.clf.booster_.predict(X_mat, pred_contrib=True)[0]
            n_features = len(self.cols_55)
            clf_contrib_matrix = raw_clf_contrib.reshape((3, n_features + 1))

            # Target class contributions based on signal (target_c_idx set above: 2 for UP, 0 for DOWN, 1 for NEUTRAL)
            class_contribs = clf_contrib_matrix[target_c_idx, :n_features]

            # Top 3 positive contributors (Reasons)
            pos_indices = np.argsort(class_contribs)[::-1]
            reasons = []
            for idx in pos_indices:
                c_val = class_contribs[idx]
                if c_val <= 0 or len(reasons) >= 3:
                    break
                feat_name = self.cols_55[idx]
                meta = FEATURE_METADATA.get(feat_name, {'name': feat_name})
                val = feat_vector[idx]
                reasons.append(
                    f"{meta['name']} (value: {val:.2f}) positively supported {signal} probability (+{c_val:.3f} SHAP)."
                )

            # Top 2 negative contributors (Risks)
            neg_indices = np.argsort(class_contribs)
            risks = []
            for idx in neg_indices:
                c_val = class_contribs[idx]
                if c_val >= 0 or len(risks) >= 2:
                    break
                feat_name = self.cols_55[idx]
                meta = FEATURE_METADATA.get(feat_name, {'name': feat_name})
                val = feat_vector[idx]
                risks.append(
                    f"{meta['name']} (value: {val:.2f}) detracted from signal conviction ({c_val:.3f} SHAP)."
                )

            # Add uncertainty descriptor to risks
            if uncertainty_proxy > 0.15:
                risks.append(f"Empirical dispersion is elevated (uncertainty proxy: {uncertainty_proxy * 100.0:.1f}%).")
            else:
                risks.append(f"Empirical dispersion is contained (uncertainty proxy: {uncertainty_proxy * 100.0:.1f}%).")

            # 5. Portfolio Context (Eligibility & Ranking)
            conviction = p_up - p_down
            eligible = bool(conviction >= 0.10)  # Phase 4F Predefined Strategy C threshold

            # Ranking context if provided, else single-asset standalone
            rank = 0
            portfolio_weight = 0.0
            if ranking_context and clean_sym in ranking_context:
                ctx = ranking_context[clean_sym]
                rank = ctx.get('rank', 0)
                eligible = ctx.get('eligible', eligible)
                portfolio_weight = ctx.get('portfolio_weight', 0.0)

            return {
                "asset": clean_sym,
                "asset_class": "equity",
                "date": record_date,
                "signal": signal,
                "probabilities": {
                    "down": p_down,
                    "neutral": p_neutral,
                    "up": p_up
                },
                "expected_return_21d": exp_r21_ridge,
                "expected_return_21d_lgbm": exp_r21_lgbm,
                "quantiles": {
                    "q10": q10,
                    "q50": q50,
                    "q90": q90
                },
                "uncertainty_proxy": uncertainty_proxy,
                "rank": rank,
                "eligible": eligible,
                "portfolio_weight": portfolio_weight,
                "reasons": reasons,
                "risks": risks,
                "model_version": MODEL_VERSION,
                "feature_version": FEATURE_VERSION,
                "portfolio_strategy_version": PORTFOLIO_STRATEGY_VERSION,
                "status": "success",
                "supported": True,
                # Backward-compatible fields
                "trend": signal,
                "confidence": round(winning_dir_prob * 100.0, 2),
                "price_change_pct": round(exp_r21_ridge * 100.0, 2),
                "predicted_price": round(current_price * (1.0 + exp_r21_ridge), 2),
                "current_price": round(current_price, 2),
                "symbol": clean_sym,
                "model_type": "uprise-21d"
            }

        # Pathway 2: Phase 5B Broad Indian Equity Pipeline (44 Features)
        if not self.is_broad_loaded:
            self.load_and_verify_models()
        if not self.is_broad_loaded:
            return {
                "asset": clean_sym,
                "asset_class": "equity",
                "status": "unavailable",
                "supported": False,
                "signal": "NEUTRAL",
                "trend": "NEUTRAL",
                "confidence": 0.0,
                "message": "Phase 5B broad equity prediction model is currently unavailable.",
                "symbol": clean_sym
            }

        # Normalize equity symbol for Indian market
        broad_sym = clean_sym
        if not broad_sym.endswith('.NS') and not broad_sym.endswith('.BO'):
            broad_sym = f"{broad_sym}.NS"

        stock_df = self._get_stock_history(broad_sym)
        bars_count = len(stock_df) if (isinstance(stock_df, pd.DataFrame) and not stock_df.empty) else 0

        # Tier C (<250 bars) or Tier D (Delisted / Missing)
        if stock_df.empty or bars_count < 250:
            tier_label = f"Tier C ({bars_count} bars, minimum 250 required)" if bars_count > 0 else "Tier D (Delisted or unavailable)"
            return {
                "asset": broad_sym,
                "asset_class": "equity",
                "status": "unavailable",
                "supported": False,
                "signal": "NEUTRAL",
                "trend": "NEUTRAL",
                "confidence": 0.0,
                "expected_return_21d": 0.0,
                "quantiles": {"q10": 0.0, "q50": 0.0, "q90": 0.0},
                "uncertainty_proxy": 0.0,
                "rank": 0,
                "eligible": False,
                "portfolio_weight": 0.0,
                "reasons": [],
                "risks": [
                    f"Insufficient historical trading data for broad equity model ({bars_count} bars available, minimum 250 required).",
                    f"Asset falls under {tier_label}."
                ],
                "message": f"Historical market data for {broad_sym} is insufficient for reliable 21-day forecasting ({bars_count}/250 bars required).",
                "model_version": MODEL_VERSION_BROAD,
                "feature_version": FEATURE_VERSION_BROAD,
                "portfolio_strategy_version": "standalone",
                "symbol": broad_sym
            }

        # Align with benchmark market data
        nifty_df, vix_df = self._get_benchmark_data()
        if nifty_df.empty or vix_df.empty:
            return {
                "asset": broad_sym,
                "asset_class": "equity",
                "status": "unavailable",
                "supported": False,
                "signal": "NEUTRAL",
                "trend": "NEUTRAL",
                "confidence": 0.0,
                "message": "Market benchmark data (NIFTY 50 / INDIA VIX) temporarily unavailable.",
                "symbol": broad_sym
            }

        if as_of_date:
            target_ts = pd.to_datetime(as_of_date)
            stock_sub = stock_df[stock_df.index <= target_ts]
            nifty_sub = nifty_df[nifty_df.index <= target_ts]
            vix_sub = vix_df[vix_df.index <= target_ts]
        else:
            stock_sub = stock_df
            nifty_sub = nifty_df
            vix_sub = vix_df

        if len(stock_sub) < 250:
            return {
                "asset": broad_sym,
                "asset_class": "equity",
                "status": "unavailable",
                "supported": False,
                "signal": "NEUTRAL",
                "trend": "NEUTRAL",
                "confidence": 0.0,
                "message": f"Insufficient historical bars for {broad_sym} prior to {as_of_date} ({len(stock_sub)} bars).",
                "symbol": broad_sym
            }

        # Extract 44 backward-looking features
        feat_df = extract_broad_features(stock_sub, nifty_sub, vix_sub)
        validate_features(feat_df)

        X_raw = feat_df.iloc[[-1]]
        record_date = str(feat_df.index[-1].date())
        current_price = float(stock_sub['Close'].iloc[-1])

        # Preprocess features using fitted training-only FoldPreprocessor
        X_trans = self.broad_preprocessor.transform(X_raw)

        # 1. Base Classifier Probabilities
        probs = self.broad_clf.predict_proba(X_trans)[0]
        p_down = float(probs[0])
        p_neutral = float(probs[1])
        p_up = float(probs[2])

        if p_up > p_down:
            signal = "UP"
            winning_dir_prob = p_up
            target_c_idx = 2
        elif p_down > p_up:
            signal = "DOWN"
            winning_dir_prob = p_down
            target_c_idx = 0
        else:
            signal = "NEUTRAL"
            winning_dir_prob = p_neutral
            target_c_idx = 1

        # 2. Ridge Expected Return
        exp_r21_ridge = float(self.broad_ridge.predict(X_trans)[0])

        # 3. Quantile Dispersion (Uncertainty Proxy)
        q10 = float(self.broad_q10.predict(X_trans)[0])
        q50 = float(self.broad_q50.predict(X_trans)[0])
        q90 = float(self.broad_q90.predict(X_trans)[0])
        if q10 > q90:
            q10, q90 = q90, q10
        uncertainty_proxy = float(q90 - q10)

        # 4. Decoupled Explainability
        expl_dict = self.broad_explainer.explain(
            X_trans,
            X_raw,
            target_c_idx,
            {"down": p_down, "neutral": p_neutral, "up": p_up}
        )
        reasons = expl_dict.get('reasons', [])
        risks = expl_dict.get('risks', [])

        if uncertainty_proxy > 0.15:
            risks.append(f"Empirical dispersion is elevated (uncertainty proxy: {uncertainty_proxy * 100.0:.1f}%).")
        else:
            risks.append(f"Empirical dispersion is contained (uncertainty proxy: {uncertainty_proxy * 100.0:.1f}%).")

        if 250 <= len(stock_sub) < 500:
            risks.append("Recent listing / shorter history (Tier B, <500 bars): forecast subject to higher estimation variance.")

        return {
            "asset": broad_sym,
            "asset_class": "equity",
            "date": record_date,
            "signal": signal,
            "probabilities": {
                "down": p_down,
                "neutral": p_neutral,
                "up": p_up
            },
            "expected_return_21d": exp_r21_ridge,
            "expected_return_21d_lgbm": exp_r21_ridge,
            "quantiles": {
                "q10": q10,
                "q50": q50,
                "q90": q90
            },
            "uncertainty_proxy": uncertainty_proxy,
            "rank": 0,
            "eligible": False,
            "portfolio_weight": 0.0,
            "reasons": reasons,
            "risks": risks,
            "model_version": MODEL_VERSION_BROAD,
            "feature_version": FEATURE_VERSION_BROAD,
            "portfolio_strategy_version": "standalone",
            "status": "success",
            "supported": True,
            # Backward-compatible fields
            "trend": signal,
            "confidence": round(winning_dir_prob * 100.0, 2),
            "price_change_pct": round(exp_r21_ridge * 100.0, 2),
            "predicted_price": round(current_price * (1.0 + exp_r21_ridge), 2),
            "current_price": round(current_price, 2),
            "symbol": broad_sym,
            "model_type": "uprise-21d-broad"
        }

    def generate_portfolio_recommendation(self, as_of_date=None):
        """
        Executes Phase 4F Strategy C portfolio allocation recommendation:
        1. Evaluates all 7 Indian equities
        2. Filters for high conviction (P(UP) - P(DOWN) >= 0.10)
        3. Ranks eligible equities by Ridge expected 21D return
        4. Selects Top-3
        5. Computes conviction-based sizing with strict 35% single-stock cap and 100% max equity exposure
        6. Allocates residual or 100% defensive cash if zero equities qualify
        STRICTLY RECOMMENDATION ONLY: Zero orders placed.
        """
        if not self.is_loaded:
            self.load_and_verify_models()

        asset_scores = []
        for sym in EQUITY_UNIVERSE:
            try:
                pred = self.predict_single_asset(sym, as_of_date=as_of_date)
                p_up = pred['probabilities']['up']
                p_down = pred['probabilities']['down']
                conviction = p_up - p_down
                eligible = bool(conviction >= 0.10)
                asset_scores.append({
                    'symbol': sym,
                    'p_up': p_up,
                    'p_down': p_down,
                    'conviction': conviction,
                    'expected_return_21d': pred['expected_return_21d'],
                    'interval_width': pred['uncertainty_proxy'],
                    'realized_vol_30d': 0.20,  # Default fallback
                    'eligible': eligible,
                    'prediction': pred
                })
            except Exception as e:
                logger.warning(f"Could not score {sym} for portfolio recommendation: {e}")

        if not asset_scores:
            return {
                "timestamp": str(as_of_date or pd.Timestamp.now().date()),
                "status": "error",
                "message": "No assets could be scored for portfolio recommendation.",
                "total_equity_exposure": 0.0,
                "cash_weight": 1.0,
                "recommendations": [],
                "order_execution_disabled": True
            }

        # 1. Rank all assets by Ridge expected return descending
        asset_scores.sort(key=lambda x: x['expected_return_21d'], reverse=True)
        for idx, item in enumerate(asset_scores):
            item['rank'] = idx + 1

        # 2. Filter eligible assets (conviction >= 0.10)
        eligible_assets = [item for item in asset_scores if item['eligible']]

        # 3. Select Top-3 among eligible
        top_k = eligible_assets[:3]

        # 4. Position Sizing: Conviction weight with 35% cap
        allocations = {}
        if len(top_k) > 0:
            df_selected = pd.DataFrame(top_k)
            # Use conviction weighting
            weights = compute_position_weights(df_selected, method='conviction_weight', max_weight=0.35)
            for item in top_k:
                allocations[item['symbol']] = weights.get(item['symbol'], 0.0)

        total_equity_exposure = sum(allocations.values())
        cash_weight = max(0.0, 1.0 - total_equity_exposure)

        # 5. Build final recommendation objects
        ranking_context = {}
        for item in asset_scores:
            sym = item['symbol']
            weight = allocations.get(sym, 0.0)
            ranking_context[sym] = {
                'rank': item['rank'],
                'eligible': item['eligible'],
                'portfolio_weight': weight
            }

        recommendations = []
        for item in asset_scores:
            sym = item['symbol']
            ctx = ranking_context[sym]
            pred = item['prediction']
            pred['rank'] = ctx['rank']
            pred['eligible'] = ctx['eligible']
            pred['portfolio_weight'] = ctx['portfolio_weight']
            recommendations.append(pred)

        action_summary = "DEFENSIVE_CASH_100%" if total_equity_exposure == 0 else "ALLOCATE_TOP_3"

        return {
            "timestamp": str(as_of_date or pd.Timestamp.now().date()),
            "strategy": "Phase 4F Strategy C (High-Conviction Gating + Ridge Ranking)",
            "conviction_threshold": 0.10,
            "max_single_stock_cap": 0.35,
            "max_equity_exposure": 1.00,
            "universe_size": len(EQUITY_UNIVERSE),
            "eligible_count": len(eligible_assets),
            "selected_count": len(top_k),
            "total_equity_exposure": round(float(total_equity_exposure), 4),
            "cash_weight": round(float(cash_weight), 4),
            "action_summary": action_summary,
            "recommendations": recommendations,
            "cash_recommendation": {
                "weight": round(float(cash_weight), 4),
                "action": "HOLD_CASH_RISK_FREE" if cash_weight > 0 else "ZERO_CASH",
                "annual_rate": 0.06,
                "reason": (
                    "Defensive cash preservation active: zero equities passed the conviction hurdle (P(UP) - P(DOWN) >= 0.10)."
                    if total_equity_exposure == 0
                    else "Residual cash balance earning risk-free interest."
                )
            },
            "order_execution_disabled": True,
            "notice": "RECOMMENDATION ONLY. No live orders or automated trading executed."
        }


# Singleton instance for application lifecycle
_service_instance = None

def get_production_21d_service():
    global _service_instance
    if _service_instance is None:
        _service_instance = Production21dService()
    return _service_instance
