"""
UPRISE ML V2 — Phase 4E-3
Deterministic Quantitative Explainability Engine

Provides rigorous, model-grounded explanations for:
1. LightGBM 3-Class Classifier (Local TreeSHAP attributions for DOWN, NEUTRAL, UP)
2. LightGBM Return Regressor (Local TreeSHAP attributions for forward return)
3. Ridge Return Model (Standardized coefficient attributions)

Features:
- Mathematical efficiency verification (sum of contributions + base value == raw model output)
- Extraction of top positive and negative contributors per sample
- Deterministic, rule-based text generation (zero hallucinated statements, zero causal language)
- Saves explainability_results.json
"""

import os
import sys
import json
import pickle
import lightgbm as lgb
import numpy as np
import pandas as pd

# Ensure sys.path includes research_21d and ml-service
current_dir = os.path.dirname(os.path.abspath(__file__))
research_dir = os.path.abspath(os.path.join(current_dir, '..'))
ml_service_dir = os.path.abspath(os.path.join(research_dir, '..'))
for p in [ml_service_dir, research_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from dataset_21d import load_and_build_21d_dataset, TRAINING_UNIVERSE

EQUITY_SYMBOLS = [s for s, t in TRAINING_UNIVERSE if t == 'stocks']

# Verified Feature Descriptions & Contextual Lexicon
FEATURE_METADATA = {
    'ema50_to_ema200': {'name': 'EMA50/EMA200 Trend Ratio', 'category': 'Trend/Momentum'},
    'close_to_ema50': {'name': 'Distance from EMA50', 'category': 'Trend/Momentum'},
    'close_to_ema200': {'name': 'Distance from EMA200', 'category': 'Trend/Momentum'},
    'ema20_to_ema50': {'name': 'EMA20/EMA50 Short-to-Medium Trend', 'category': 'Trend/Momentum'},
    'rsi_14': {'name': '14-Day Relative Strength Index (RSI)', 'category': 'Momentum'},
    'macd': {'name': 'MACD Line', 'category': 'Momentum'},
    'macd_hist': {'name': 'MACD Histogram', 'category': 'Momentum'},
    'stoch_k': {'name': 'Stochastic %K', 'category': 'Momentum'},
    'stoch_d': {'name': 'Stochastic %D', 'category': 'Momentum'},
    'roc_20d': {'name': '20-Day Rate of Change', 'category': 'Momentum'},
    'return_1d': {'name': '1-Day Trailing Return', 'category': 'Short-Term Return'},
    'return_2d': {'name': '2-Day Trailing Return', 'category': 'Short-Term Return'},
    'return_3d': {'name': '3-Day Trailing Return', 'category': 'Short-Term Return'},
    'return_5d': {'name': '5-Day Trailing Return', 'category': 'Short-Term Return'},
    'return_10d': {'name': '10-Day Trailing Return', 'category': 'Short-Term Return'},
    'return_21d': {'name': '21-Day Trailing Return', 'category': 'Medium-Term Return'},
    'atr14_to_close': {'name': '14-Day ATR / Close Volatility Ratio', 'category': 'Volatility'},
    'bb_pct_b': {'name': 'Bollinger Bands %B', 'category': 'Volatility/Range'},
    'bb_bandwidth': {'name': 'Bollinger Bandwidth', 'category': 'Volatility/Range'},
    'realized_vol_30d': {'name': '30-Day Realized Volatility', 'category': 'Volatility'},
    'volume_to_vol20': {'name': 'Volume to 20-Day Average Ratio', 'category': 'Volume/Liquidity'},
    'obv_slope_10d': {'name': '10-Day On-Balance Volume Slope', 'category': 'Volume/Liquidity'},
    'vwap_ratio_20d': {'name': 'Price to 20-Day VWAP Ratio', 'category': 'Volume/Liquidity'},
    'normalized_hl_spread': {'name': 'Normalized High-Low Daily Spread', 'category': 'Volatility'},
    'gap_return': {'name': 'Overnight Gap Return', 'category': 'Short-Term Return'},
    'nifty_return_1d': {'name': 'Nifty 50 1-Day Return', 'category': 'Market Context'},
    'nifty_return_5d': {'name': 'Nifty 50 5-Day Return', 'category': 'Market Context'},
    'nifty_return_20d': {'name': 'Nifty 50 20-Day Return', 'category': 'Market Context'},
    'relative_strength_5d': {'name': '5-Day Relative Strength vs Benchmark', 'category': 'Market Context'},
    'vix_level': {'name': 'India VIX Volatility Level', 'category': 'Market Context'},
    'vix_change_5d': {'name': '5-Day Change in India VIX', 'category': 'Market Context'},
    'revenue_growth_yoy': {'name': 'YoY Revenue Growth', 'category': 'Fundamental Growth'},
    'revenue_growth_qoq': {'name': 'QoQ Revenue Growth', 'category': 'Fundamental Growth'},
    'revenue_ttm_growth': {'name': 'TTM Revenue Growth', 'category': 'Fundamental Growth'},
    'net_profit_growth_yoy': {'name': 'YoY Net Profit Growth', 'category': 'Fundamental Growth'},
    'net_profit_margin': {'name': 'Net Profit Margin', 'category': 'Fundamental Profitability'},
    'operating_margin': {'name': 'Operating Profit Margin', 'category': 'Fundamental Profitability'},
    'eps_growth_yoy': {'name': 'YoY EPS Growth', 'category': 'Fundamental Growth'},
    'roe': {'name': 'Return on Equity (ROE)', 'category': 'Fundamental Quality'},
    'roce': {'name': 'Return on Capital Employed (ROCE)', 'category': 'Fundamental Quality'},
    'roa': {'name': 'Return on Assets (ROA)', 'category': 'Fundamental Quality'},
    'net_debt_to_equity': {'name': 'Net Debt-to-Equity Ratio', 'category': 'Financial Leverage'},
    'interest_coverage': {'name': 'Interest Coverage Ratio', 'category': 'Financial Leverage'},
    'debt_growth_yoy': {'name': 'YoY Debt Growth', 'category': 'Financial Leverage'},
    'fcf_margin': {'name': 'Free Cash Flow Margin', 'category': 'Fundamental Cash Flow'},
    'fcf_growth_yoy': {'name': 'YoY Free Cash Flow Growth', 'category': 'Fundamental Cash Flow'},
    'ocf_to_net_profit': {'name': 'Operating Cash Flow to Net Profit Ratio', 'category': 'Fundamental Cash Flow'},
    'earnings_acceleration': {'name': 'Earnings Growth Acceleration', 'category': 'Fundamental Growth'},
    'eps_acceleration': {'name': 'EPS Growth Acceleration', 'category': 'Fundamental Growth'},
    'margin_expansion_yoy': {'name': 'YoY Margin Expansion', 'category': 'Fundamental Profitability'},
    'revenue_vs_profit_growth': {'name': 'Revenue vs Profit Growth Differential', 'category': 'Fundamental Quality'},
    'days_since_latest_filing': {'name': 'Days Since Latest Quarterly Filing', 'category': 'Filing Recency'},
    'pe_ratio_pit': {'name': 'Point-in-Time P/E Ratio', 'category': 'Valuation'},
    'pb_ratio_pit': {'name': 'Point-in-Time P/B Ratio', 'category': 'Valuation'},
    'has_fundamentals': {'name': 'Fundamental Data Availability Flag', 'category': 'Data Quality'}
}

class QuantitativeExplainer:
    def __init__(self, models_dict, config):
        self.clf = models_dict['clf_base']
        self.reg_lgbm = models_dict['lgbm_mean_base']
        self.reg_q10 = models_dict['lgbm_q10_base']
        self.reg_q50 = models_dict['lgbm_q50_base']
        self.reg_q90 = models_dict['lgbm_q90_base']
        self.ridge = models_dict['ridge_base']
        self.scaler = models_dict['scaler_base']
        self.imputer = models_dict['imputer_base']
        self.cols_55 = config['features']
        self.strat_b_tau = config['strat_b_thresholds']
        
    def compute_explanations(self, X_df):
        """
        Computes local SHAP attributions for LightGBM and standardized attributions for Ridge.
        """
        X_mat = np.ascontiguousarray(X_df[self.cols_55].values, dtype=np.float64)
        n_samples = len(X_mat)
        n_features = len(self.cols_55)
        
        # 1. LightGBM Classifier TreeSHAP
        # Returns shape (N, 3 * (n_features + 1))
        raw_clf_contrib = self.clf.booster_.predict(X_mat, pred_contrib=True)
        # Reshape to (N, 3, n_features + 1)
        clf_shap = raw_clf_contrib.reshape((n_samples, 3, n_features + 1))
        
        # 2. LightGBM Regressor TreeSHAP
        # Returns shape (N, n_features + 1)
        reg_shap = self.reg_lgbm.booster_.predict(X_mat, pred_contrib=True)
        
        # 3. Ridge Standardized Attributions
        X_imp = self.imputer.transform(X_mat)
        X_scl = self.scaler.transform(X_imp)
        ridge_contrib = X_scl * self.ridge.coef_
        ridge_base_val = float(self.ridge.intercept_)
        
        # Model predictions
        probs = self.clf.predict_proba(X_mat)
        pred_3c = np.argmax(probs, axis=1)
        pred_r_lgbm = self.reg_lgbm.predict(X_mat)
        pred_q10 = self.reg_q10.predict(X_mat)
        pred_q50 = self.reg_q50.predict(X_mat)
        pred_q90 = self.reg_q90.predict(X_mat)
        pred_r_ridge = self.ridge.predict(X_scl)
        
        return {
            'clf_shap': clf_shap,
            'reg_shap': reg_shap,
            'ridge_contrib': ridge_contrib,
            'ridge_base_val': ridge_base_val,
            'probs': probs,
            'pred_3c': pred_3c,
            'pred_r_lgbm': pred_r_lgbm,
            'pred_q10': pred_q10,
            'pred_q50': pred_q50,
            'pred_q90': pred_q90,
            'pred_r_ridge': pred_r_ridge,
            'X_mat': X_mat
        }

    def generate_human_readable_explanation(self, sample_idx, exp_dict, df_row):
        """
        Converts verified quantitative contributions for a single sample into deterministic structured text.
        """
        p_c = exp_dict['pred_3c'][sample_idx]
        class_names = {0: 'DOWN', 1: 'NEUTRAL', 2: 'UP'}
        pred_label = class_names[p_c]
        
        expected_r = exp_dict['pred_r_lgbm'][sample_idx]
        q10 = exp_dict['pred_q10'][sample_idx]
        q90 = exp_dict['pred_q90'][sample_idx]
        width = q90 - q10
        probs = exp_dict['probs'][sample_idx]
        
        # Classifier SHAP for predicted class
        c_shap = exp_dict['clf_shap'][sample_idx, p_c, :len(self.cols_55)]
        c_base = exp_dict['clf_shap'][sample_idx, p_c, -1]
        
        # Regressor SHAP
        r_shap = exp_dict['reg_shap'][sample_idx, :len(self.cols_55)]
        r_base = exp_dict['reg_shap'][sample_idx, -1]
        
        # Ridge contributions
        ridge_c = exp_dict['ridge_contrib'][sample_idx]
        
        # Rank features for classifier
        top_pos_clf = np.argsort(-c_shap)[:3]
        top_neg_clf = np.argsort(c_shap)[:2]
        
        # Rank features for regressor
        top_pos_reg = np.argsort(-r_shap)[:3]
        top_neg_reg = np.argsort(r_shap)[:2]
        
        why_bullets = []
        
        # Sentence 1: Primary classifier driver
        feat_1 = self.cols_55[top_pos_clf[0]]
        val_1 = float(exp_dict['X_mat'][sample_idx, top_pos_clf[0]])
        meta_1 = FEATURE_METADATA.get(feat_1, {'name': feat_1, 'category': 'General'})
        why_bullets.append(
            f"1. {meta_1['name']} (value: {val_1:.2f}) was the strongest positive contributor (+{c_shap[top_pos_clf[0]]:.3f} SHAP) supporting the {pred_label} directional call."
        )
        
        # Sentence 2: Secondary classifier driver
        feat_2 = self.cols_55[top_pos_clf[1]]
        val_2 = float(exp_dict['X_mat'][sample_idx, top_pos_clf[1]])
        meta_2 = FEATURE_METADATA.get(feat_2, {'name': feat_2, 'category': 'General'})
        why_bullets.append(
            f"2. {meta_2['name']} (value: {val_2:.2f}) contributed positively (+{c_shap[top_pos_clf[1]]:.3f} SHAP) to {pred_label} probability."
        )
        
        # Sentence 3: Regressor return driver
        reg_top = top_pos_reg[0] if expected_r >= 0 else top_neg_reg[0]
        feat_reg = self.cols_55[reg_top]
        val_reg = float(exp_dict['X_mat'][sample_idx, reg_top])
        meta_reg = FEATURE_METADATA.get(feat_reg, {'name': feat_reg, 'category': 'General'})
        reg_dir = "higher" if r_shap[reg_top] > 0 else "lower"
        why_bullets.append(
            f"3. {meta_reg['name']} (value: {val_reg:.2f}) pushed the expected 21-day return toward {reg_dir} movement ({r_shap[reg_top]:+.2%} return contribution)."
        )
        
        # Sentence 4: Uncertainty / Dispersion context
        unc_level = "elevated" if width > 0.15 else ("moderate" if width > 0.12 else "contained")
        why_bullets.append(
            f"4. Prediction interval width is {width*100:.1f}% ({unc_level} dispersion), bounding the 10th-to-90th percentile outcome range between {q10*100:+.1f}% and {q90*100:+.1f}%."
        )
        
        explanation_text = (
            f"Prediction: {pred_label} (P(DOWN)={probs[0]*100:.1f}%, P(NEU)={probs[1]*100:.1f}%, P(UP)={probs[2]*100:.1f}%)\n"
            f"Expected 21D Return: {expected_r*100:+.2f}%\n"
            f"Prediction Range: {q10*100:+.1f}% to {q90*100:+.1f}%\n"
            f"Why:\n" + "\n".join(why_bullets)
        )
        
        structured_data = {
            'sample_idx': int(sample_idx),
            'symbol': str(df_row['symbol']) if 'symbol' in df_row else "",
            'date': str(df_row.name.date()) if hasattr(df_row, 'name') and hasattr(df_row.name, 'date') else "",
            'predicted_class': pred_label,
            'probabilities': {'DOWN': float(probs[0]), 'NEUTRAL': float(probs[1]), 'UP': float(probs[2])},
            'expected_return_21d': float(expected_r),
            'prediction_interval': {'q10': float(q10), 'q50': float(exp_dict['pred_q50'][sample_idx]), 'q90': float(q90), 'width': float(width)},
            'top_classifier_contributors': [
                {'feature': self.cols_55[i], 'name': FEATURE_METADATA.get(self.cols_55[i], {}).get('name', self.cols_55[i]), 'shap_value': float(c_shap[i]), 'value': float(exp_dict['X_mat'][sample_idx, i])}
                for i in top_pos_clf
            ],
            'top_regressor_contributors': [
                {'feature': self.cols_55[i], 'name': FEATURE_METADATA.get(self.cols_55[i], {}).get('name', self.cols_55[i]), 'shap_value': float(r_shap[i]), 'value': float(exp_dict['X_mat'][sample_idx, i])}
                for i in top_pos_reg
            ],
            'top_ridge_contributors': [
                {'feature': self.cols_55[i], 'name': FEATURE_METADATA.get(self.cols_55[i], {}).get('name', self.cols_55[i]), 'contribution': float(ridge_c[i]), 'value': float(exp_dict['X_mat'][sample_idx, i])}
                for i in np.argsort(-np.abs(ridge_c))[:3]
            ],
            'explanation_text': explanation_text
        }
        
        return structured_data

def run_explainability_audit():
    print("=======================================================")
    print("PHASE 4E-3: QUANTITATIVE EXPLAINABILITY AUDIT")
    print("=======================================================")
    
    full_df, valid_df, summary = load_and_build_21d_dataset()
    
    config_path = os.path.join(research_dir, 'config', 'hybrid_21d_config.json')
    with open(config_path, 'r') as f:
        config = json.load(f)
        
    models_path = os.path.join(research_dir, 'models', 'hybrid21d_models.pkl')
    with open(models_path, 'rb') as f:
        models_dict = pickle.load(f)
        
    explainer = QuantitativeExplainer(models_dict, config)
    
    dates = full_df.index.unique().sort_values()
    val_idx_end = int(len(dates) * 0.85)
    embargo_end = val_idx_end + 5
    
    te_df = valid_df[valid_df.index.isin(dates[embargo_end:])].copy()
    te_eq = te_df[te_df['symbol'].isin(EQUITY_SYMBOLS)].copy()
    
    print(f"Computing exact TreeSHAP attributions for {len(te_eq)} locked test observations...")
    exp_dict = explainer.compute_explanations(te_eq)
    
    # Mathematical Efficiency Verification (Additivity property of SHAP)
    # 1. Regressor: sum(SHAP) + base_val == pred_r_lgbm
    reg_shap_sum = np.sum(exp_dict['reg_shap'][:, :-1], axis=1) + exp_dict['reg_shap'][:, -1]
    max_reg_diff = float(np.max(np.abs(reg_shap_sum - exp_dict['pred_r_lgbm'])))
    
    # 2. Ridge: sum(contrib) + intercept == pred_r_ridge
    ridge_sum = np.sum(exp_dict['ridge_contrib'], axis=1) + exp_dict['ridge_base_val']
    max_ridge_diff = float(np.max(np.abs(ridge_sum - exp_dict['pred_r_ridge'])))
    
    print(f"Mathematical Efficiency Check:")
    print(f"  LightGBM Regressor Max Additive Diff: {max_reg_diff:.2e} (Pass: {max_reg_diff < 1e-4})")
    print(f"  Ridge Regressor Max Additive Diff:    {max_ridge_diff:.2e} (Pass: {max_ridge_diff < 1e-4})")
    
    # Generate explanations for sample predictions across assets
    sample_explanations = []
    # Pick 1 sample from each asset
    for sym in EQUITY_SYMBOLS:
        sub_indices = np.where(te_eq['symbol'].values == sym)[0]
        if len(sub_indices) > 0:
            target_idx = sub_indices[len(sub_indices) // 2] # Midpoint sample
            row = te_eq.iloc[target_idx]
            exp = explainer.generate_human_readable_explanation(target_idx, exp_dict, row)
            sample_explanations.append(exp)
            
    print("\n--- SAMPLE GENERATED EXPLANATION (RELIANCE.NS) ---")
    print(sample_explanations[0]['explanation_text'])
    
    print("\n--- SAMPLE GENERATED EXPLANATION (TCS.NS) ---")
    print(sample_explanations[1]['explanation_text'])
    
    results = {
        'explainability_status': 'Ready',
        'methodology': {
            'tree_models': "Native TreeSHAP (LGBM_BoosterPredictForMat with pred_contrib=True)",
            'linear_models': "Standardized feature-space linear attribution (Z-scaled X * coef)",
            'efficiency_verification': {
                'lgbm_regressor_max_diff': max_reg_diff,
                'ridge_regressor_max_diff': max_ridge_diff,
                'efficiency_passed': bool(max_reg_diff < 1e-4 and max_ridge_diff < 1e-4)
            }
        },
        'feature_catalog_size': len(FEATURE_METADATA),
        'sample_explanations': sample_explanations
    }
    
    return results

if __name__ == '__main__':
    res = run_explainability_audit()
    out_file = os.path.join(current_dir, 'explainability_results.json')
    with open(out_file, 'w') as f:
        json.dump(res, f, indent=2)
    print(f"\nSaved explainability audit results to {out_file}")

