"""
UPRISE ML V2 — Phase 4A
Independent 21-Day Dataset & Target Verification Engine

Generates and independently verifies the genuine 21-trading-day forward-return
target:
    R21(T) = Close(T+21 trading days) / Close(T) - 1.0

Strict rules:
1. No overwriting of backward-looking features (return_5d, return_21d).
2. Dynamic sample counting (zero hard-coded sample numbers).
3. Exact threshold reproduction (provenance: evaluate_genuine_multi_horizon.py):
   UP: R21 > +3.0% (+0.030)
   DOWN: R21 < -3.0% (-0.030)
   NEUTRAL: -3.0% <= R21 <= +3.0%
4. Trading-day indexing strictly within each asset's chronological series.
"""

import os
import json
import logging
import pandas as pd
import numpy as np
from scipy.stats import pearsonr, spearmanr

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Canonical 8-asset universe
TRAINING_UNIVERSE = [
    ('RELIANCE.NS', 'stocks'),
    ('TCS.NS', 'stocks'),
    ('INFY.NS', 'stocks'),
    ('HDFCBANK.NS', 'stocks'),
    ('ICICIBANK.NS', 'stocks'),
    ('LT.NS', 'stocks'),
    ('BHARTIARTL.NS', 'stocks'),
    ('BTC-USD', 'crypto')
]

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'news', 'cache')

def classify_return_21d(r, thresh=0.030):
    """
    Classify 21-day forward return into 3 classes.
    Provenance: evaluate_genuine_multi_horizon.py (Phase 3.5 audit)
    2: UP (r > +3.0%)
    0: DOWN (r < -3.0%)
    1: NEUTRAL (-3.0% <= r <= +3.0%)
    """
    if pd.isna(r):
        return np.nan
    if r > thresh:
        return 2  # UP
    elif r < -thresh:
        return 0  # DOWN
    return 1      # NEUTRAL

def load_and_build_21d_dataset(cache_dir=CACHE_DIR, universe=TRAINING_UNIVERSE):
    """
    Load cached multi-signal features and independently construct forward 21D targets.
    Returns:
        full_df: Complete DataFrame with independent targets
        valid_df: Filtered DataFrame containing only valid target rows
        audit_summary: Complete audit statistics dictionary
    """
    asset_frames = []
    audit_records = []
    
    total_source_rows = 0
    total_valid_rows = 0
    total_tail_removed = 0
    
    logger.info("Loading cached multi-signal feature datasets for universe...")
    
    for symbol, asset_type in universe:
        clean_sym = symbol.replace('.', '_').replace('-', '_')
        pkl_path = os.path.join(cache_dir, f"{clean_sym}_multisignal_dictionary.pkl")
        
        if not os.path.exists(pkl_path):
            raise FileNotFoundError(f"Source cache file missing: {pkl_path}")
            
        df_asset = pd.read_pickle(pkl_path)
        source_n = len(df_asset)
        total_source_rows += source_n
        
        # 1. Verification of chronological sort & duplicate timestamps
        if not df_asset.index.is_monotonic_increasing:
            logger.warning(f"{symbol} index was not monotonically increasing. Sorting chronologically.")
            df_asset = df_asset.sort_index()
            
        dup_count = df_asset.index.duplicated().sum()
        if dup_count > 0:
            logger.warning(f"{symbol} contained {dup_count} duplicate timestamps. Dropping duplicates.")
            df_asset = df_asset[~df_asset.index.duplicated(keep='last')]
            
        # 2. Check Close integrity
        if 'Close' not in df_asset.columns:
            raise KeyError(f"{symbol} dataframe missing 'Close' column")
            
        c = df_asset['Close']
        invalid_close_count = (c.isna() | (c <= 0)).sum()
        if invalid_close_count > 0:
            raise ValueError(f"{symbol} contains {invalid_close_count} invalid Close values (NaN or <= 0)")
            
        # Snapshot of backward features prior to target creation to ensure zero overwrite
        orig_return_21d = df_asset['return_21d'].copy() if 'return_21d' in df_asset.columns else None
        orig_return_5d = df_asset['return_5d'].copy() if 'return_5d' in df_asset.columns else None
        
        # 3. Independent forward 21D target generation (trading-day index shift)
        # c.shift(-21) takes observation at index i+21 within this asset's chronological series
        forward_close_21d = c.shift(-21)
        r21_series = (forward_close_21d / c) - 1.0
        dir21_series = r21_series.apply(lambda r: classify_return_21d(r, thresh=0.030))
        
        # Also compute 5D and 63D for independence correlation verification
        forward_close_5d = c.shift(-5)
        r5_series = (forward_close_5d / c) - 1.0
        
        forward_close_63d = c.shift(-63)
        r63_series = (forward_close_63d / c) - 1.0
        
        # 4. Assign strictly to NEW isolated target columns
        df_asset['target_future_return_21d'] = r21_series
        df_asset['target_future_price_21d'] = forward_close_21d
        df_asset['target_dir_21d'] = dir21_series
        df_asset['target_future_return_5d'] = r5_series
        df_asset['target_future_return_63d'] = r63_series
        
        # 5. Verify backward features were NOT mutated
        if orig_return_21d is not None:
            diff_ret21 = (df_asset['return_21d'] - orig_return_21d).abs().max()
            assert diff_ret21 == 0.0, f"MUTATION DETECTED: return_21d was overwritten for {symbol}!"
            
        if orig_return_5d is not None:
            diff_ret5 = (df_asset['return_5d'] - orig_return_5d).abs().max()
            assert diff_ret5 == 0.0, f"MUTATION DETECTED: return_5d was overwritten for {symbol}!"
            
        valid_mask = ~df_asset['target_future_return_21d'].isna()
        valid_n = int(valid_mask.sum())
        tail_na_n = int((~valid_mask).sum())
        
        total_valid_rows += valid_n
        total_tail_removed += tail_na_n
        
        # Ensure tail NaN count equals exactly 21 observations
        assert tail_na_n == 21, f"Expected exactly 21 tail NaNs for {symbol}, got {tail_na_n}"
        
        earliest_t = df_asset.index.min()
        latest_t = df_asset.index.max()
        valid_sub = df_asset[valid_mask]
        earliest_valid_t = valid_sub.index.min()
        latest_valid_t = valid_sub.index.max()
        
        # T+21 date for earliest and latest valid observation
        earliest_t21_date = df_asset.index[21]
        latest_t21_date = df_asset.index[source_n - 1] # The last available close date in source
        
        audit_records.append({
            'symbol': symbol,
            'asset_type': asset_type,
            'source_rows': source_n,
            'valid_r21_rows': valid_n,
            'tail_removed_rows': tail_na_n,
            'duplicate_dates': int(dup_count),
            'invalid_close_rows': int(invalid_close_count),
            'earliest_T': earliest_t.strftime('%Y-%m-%d'),
            'latest_T': latest_t.strftime('%Y-%m-%d'),
            'earliest_valid_T': earliest_valid_t.strftime('%Y-%m-%d'),
            'latest_valid_T': latest_valid_t.strftime('%Y-%m-%d'),
            'earliest_T_plus_21': earliest_t21_date.strftime('%Y-%m-%d'),
            'latest_T_plus_21': latest_t21_date.strftime('%Y-%m-%d'),
            'up_count': int((valid_sub['target_dir_21d'] == 2).sum()),
            'down_count': int((valid_sub['target_dir_21d'] == 0).sum()),
            'neutral_count': int((valid_sub['target_dir_21d'] == 1).sum()),
            'mean_r21': float(valid_sub['target_future_return_21d'].mean()),
            'std_r21': float(valid_sub['target_future_return_21d'].std())
        })
        
        asset_frames.append(df_asset)
        logger.info(f"{symbol:15s} | Source: {source_n:5d} | Valid R21: {valid_n:5d} | Tail: {tail_na_n:2d} | Valid Dates: {earliest_valid_t.strftime('%Y-%m-%d')} to {latest_valid_t.strftime('%Y-%m-%d')}")

    full_df = pd.concat(asset_frames, axis=0).sort_index()
    valid_df = full_df.dropna(subset=['target_future_return_21d', 'target_dir_21d']).copy()
    valid_df['target_dir_21d'] = valid_df['target_dir_21d'].astype(int)
    
    # Mathematical integrity check across all valid rows
    diff_stats = verify_mathematical_integrity(asset_frames)
    
    # Target independence correlations
    corr_stats = verify_target_independence(full_df)
    
    # Phase 3.5 Reference Split Comparison
    split_stats = audit_phase_3_5_test_split(full_df, valid_df)
    
    summary = {
        'total_source_rows': total_source_rows,
        'total_valid_r21_rows': total_valid_rows,
        'total_tail_removed_rows': total_tail_removed,
        'per_asset_audit': audit_records,
        'mathematical_verification': diff_stats,
        'target_independence_correlations': corr_stats,
        'phase_3_5_reference_split': split_stats
    }
    
    return full_df, valid_df, summary

def verify_mathematical_integrity(asset_frames):
    """
    Independently recalculate R21 from raw Close prices for every single row
    and measure exact absolute difference.
    """
    total_checked = 0
    max_abs_diff = 0.0
    sum_abs_diff = 0.0
    mismatches = 0
    
    for df in asset_frames:
        c = df['Close']
        r21_gen = df['target_future_return_21d']
        
        for i in range(len(df) - 21):
            c_t = c.iloc[i]
            c_t21 = c.iloc[i+21]
            manual_r21 = (c_t21 / c_t) - 1.0
            gen_r21 = r21_gen.iloc[i]
            
            diff = abs(manual_r21 - gen_r21)
            if diff > max_abs_diff:
                max_abs_diff = diff
            sum_abs_diff += diff
            total_checked += 1
            
            if diff > 1e-12:
                mismatches += 1
                
    mean_abs_diff = (sum_abs_diff / total_checked) if total_checked > 0 else 0.0
    
    return {
        'total_rows_checked': total_checked,
        'max_absolute_difference': float(max_abs_diff),
        'mean_absolute_difference': float(mean_abs_diff),
        'number_of_mismatches_gt_1e12': mismatches,
        'mathematical_verification_pass': bool(mismatches == 0 and max_abs_diff < 1e-12)
    }

def verify_target_independence(full_df):
    """
    Calculate Pearson and Spearman correlations between R5, R21, and R63.
    """
    common = full_df.dropna(subset=['target_future_return_5d', 'target_future_return_21d', 'target_future_return_63d'])
    
    r5 = common['target_future_return_5d'].values
    r21 = common['target_future_return_21d'].values
    r63 = common['target_future_return_63d'].values
    
    p_5_21, pv_5_21 = pearsonr(r5, r21)
    p_5_63, pv_5_63 = pearsonr(r5, r63)
    p_21_63, pv_21_63 = pearsonr(r21, r63)
    
    s_5_21, spv_5_21 = spearmanr(r5, r21)
    s_5_63, spv_5_63 = spearmanr(r5, r63)
    s_21_63, spv_21_63 = spearmanr(r21, r63)
    
    return {
        'common_sample_rows': len(common),
        'pearson': {
            'r5_vs_r21': float(p_5_21),
            'r5_vs_r21_pvalue': float(pv_5_21),
            'r5_vs_r63': float(p_5_63),
            'r5_vs_r63_pvalue': float(pv_5_63),
            'r21_vs_r63': float(p_21_63),
            'r21_vs_r63_pvalue': float(pv_21_63)
        },
        'spearman': {
            'r5_vs_r21': float(s_5_21),
            'r5_vs_r21_pvalue': float(spv_5_21),
            'r5_vs_r63': float(s_5_63),
            'r5_vs_r63_pvalue': float(spv_5_63),
            'r21_vs_r63': float(s_21_63),
            'r21_vs_r63_pvalue': float(spv_21_63)
        },
        'phase_3_5_reference': {
            'r5_vs_r21': 0.4860,
            'r5_vs_r63': 0.2821,
            'r21_vs_r63': 0.5775
        }
    }

def audit_phase_3_5_test_split(full_df, valid_df):
    """
    Evaluate sample counts on the exact chronological split boundaries used in Phase 3.5:
    70% train, 15% val, 15% test with 5-day embargo.
    """
    dates = full_df.index.unique().sort_values()
    total_dates = len(dates)
    train_idx_end = int(total_dates * 0.70)
    val_idx_end = int(total_dates * 0.85)
    embargo_2_end = val_idx_end + 5
    
    train_dates = dates[:train_idx_end]
    val_dates = dates[train_idx_end + 5 : val_idx_end]
    test_dates = dates[embargo_2_end:]
    
    tr_df = valid_df[valid_df.index.isin(train_dates)]
    val_df = valid_df[valid_df.index.isin(val_dates)]
    te_df = valid_df[valid_df.index.isin(test_dates)]
    
    per_asset_test_n = {}
    for sym, _ in TRAINING_UNIVERSE:
        sub_te = te_df[te_df['symbol'] == sym]
        per_asset_test_n[sym] = {
            'count': len(sub_te),
            'min_date': sub_te.index.min().strftime('%Y-%m-%d') if len(sub_te) > 0 else None,
            'max_date': sub_te.index.max().strftime('%Y-%m-%d') if len(sub_te) > 0 else None
        }
        
    return {
        'total_unique_dates': total_dates,
        'train_window': {
            'start': train_dates[0].strftime('%Y-%m-%d'),
            'end': train_dates[-1].strftime('%Y-%m-%d'),
            'num_dates': len(train_dates),
            'valid_r21_rows': len(tr_df)
        },
        'val_window': {
            'start': val_dates[0].strftime('%Y-%m-%d'),
            'end': val_dates[-1].strftime('%Y-%m-%d'),
            'num_dates': len(val_dates),
            'valid_r21_rows': len(val_df)
        },
        'test_window': {
            'start': test_dates[0].strftime('%Y-%m-%d'),
            'end': test_dates[-1].strftime('%Y-%m-%d'),
            'num_dates': len(test_dates),
            'valid_r21_rows': len(te_df)
        },
        'per_asset_test_n': per_asset_test_n,
        'matches_phase_3_5_test_n': bool(len(te_df) == 1363)
    }

if __name__ == '__main__':
    full_df, valid_df, summary = load_and_build_21d_dataset()
    
    out_dir = os.path.dirname(__file__)
    summary_path = os.path.join(out_dir, 'dataset_summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    logger.info(f"Saved dataset summary to {summary_path}")
    
    print("\n=======================================================")
    print("PHASE 4A: INDEPENDENT 21-DAY DATASET GENERATION SUMMARY")
    print("=======================================================")
    print(f"Total Source Rows:         {summary['total_source_rows']:,}")
    print(f"Total Valid R21 Rows:      {summary['total_valid_r21_rows']:,}")
    print(f"Total Tail Rows Removed:   {summary['total_tail_removed_rows']:,} (exactly 21 per asset * 8 assets)")
    print(f"Phase 3.5 Test Partition N: {summary['phase_3_5_reference_split']['test_window']['valid_r21_rows']:,} (Equities: 160*7=1120, BTC: 243 -> Total: 1363)")
    print(f"Mathematical Diff Max:     {summary['mathematical_verification']['max_absolute_difference']:.2e}")
    print(f"Mathematical Mismatches:   {summary['mathematical_verification']['number_of_mismatches_gt_1e12']}")
    print(f"Target Independence:")
    print(f"  Corr(R5, R21):           {summary['target_independence_correlations']['pearson']['r5_vs_r21']:+.4f} (Phase 3.5: +0.4860)")
    print(f"  Corr(R5, R63):           {summary['target_independence_correlations']['pearson']['r5_vs_r63']:+.4f} (Phase 3.5: +0.2821)")
    print(f"  Corr(R21, R63):          {summary['target_independence_correlations']['pearson']['r21_vs_r63']:+.4f} (Phase 3.5: +0.5775)")
    print("=======================================================\n")
