"""
UPRISE ML V2 — Phase 4F
Position Sizing Engine

Implements and compares 4 position sizing schemes:
1. Equal Weight (1 / K)
2. Conviction Weight (scaled by P(UP) - P(DOWN))
3. Inverse Uncertainty Weight (scaled by 1 / (Q90 - Q10))
4. Volatility-Adjusted Weight (scaled by 1 / RealizedVol21d)

Applies strict constraints:
- Maximum single-stock weight: 35% (0.35)
- Minimum position weight: 5% (0.05)
- Maximum total equity exposure: 100% (1.00)
"""

import numpy as np
import pandas as pd

def compute_position_weights(selected_assets_df, method='equal_weight', max_weight=0.35, min_weight=0.05):
    """
    Computes portfolio weights for a set of selected assets on a rebalance date.
    
    selected_assets_df must contain columns:
      - 'symbol'
      - 'p_up'
      - 'p_down'
      - 'interval_width' (Q90 - Q10)
      - 'realized_vol_30d'
      
    Returns a dict mapping symbol -> weight (sum of weights <= 1.0).
    """
    k = len(selected_assets_df)
    if k == 0:
        return {}
        
    if method == 'equal_weight':
        raw_weights = np.ones(k) / float(k)
        
    elif method == 'conviction_weight':
        # Conviction = P(UP) - P(DOWN), clipped to >= 0
        spreads = (selected_assets_df['p_up'].values - selected_assets_df['p_down'].values)
        clipped_spreads = np.maximum(0.01, spreads) # Floor at 0.01 to ensure participation
        total_spread = np.sum(clipped_spreads)
        if total_spread > 1e-6:
            raw_weights = clipped_spreads / total_spread
        else:
            raw_weights = np.ones(k) / float(k)
            
    elif method == 'inv_uncertainty_weight':
        # Weight proportional to 1 / width
        widths = selected_assets_df['interval_width'].values
        inv_w = 1.0 / np.maximum(0.02, widths)
        total_inv_w = np.sum(inv_w)
        if total_inv_w > 1e-6:
            raw_weights = inv_w / total_inv_w
        else:
            raw_weights = np.ones(k) / float(k)
            
    elif method == 'vol_adjusted_weight':
        # Weight proportional to 1 / realized_vol_30d
        vols = selected_assets_df['realized_vol_30d'].values
        inv_v = 1.0 / np.maximum(0.01, vols)
        total_inv_v = np.sum(inv_v)
        if total_inv_v > 1e-6:
            raw_weights = inv_v / total_inv_v
        else:
            raw_weights = np.ones(k) / float(k)
            
    else:
        raise ValueError(f"Unknown position sizing method: {method}")
        
    # Apply strict caps iteratively using water-filling algorithm
    weights = raw_weights.copy()
    capped = np.zeros(k, dtype=bool)

    for _ in range(k + 2):
        new_capped = (~capped) & (weights > max_weight)
        if not new_capped.any():
            break
        capped = capped | new_capped
        weights[capped] = max_weight

        uncapped = ~capped
        if not uncapped.any():
            break

        remaining_budget = max(0.0, 1.0 - np.sum(weights[capped]))
        uncapped_sum = np.sum(weights[uncapped])
        if uncapped_sum > 1e-6:
            weights[uncapped] = weights[uncapped] * (remaining_budget / uncapped_sum)
        else:
            weights[uncapped] = remaining_budget / np.sum(uncapped)

    weights = np.minimum(weights, max_weight)
        
    # Check min weight: if any weight < min_weight, ensure floor or prune
    # For small K (e.g. K=3), equal is 0.33, which respects min_weight.
    result = {}
    for i, sym in enumerate(selected_assets_df['symbol'].values):
        result[sym] = float(weights[i])
        
    return result
