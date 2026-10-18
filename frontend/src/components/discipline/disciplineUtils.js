/**
 * UPRISE Discipline & Responsible Engagement Utilities
 * 
 * Provides verified mathematical calculations for portfolio risk health,
 * execution discipline, transparent achievement criteria, and local storage persistence.
 * Zero vanity points, zero trading volume incentives, zero gambling mechanics.
 */

export const STORAGE_KEY_LESSONS = 'uprise_completed_lessons_v1';
export const STORAGE_KEY_JOURNAL = 'uprise_trading_journal_v1';

export const CORE_LESSONS = [
  {
    id: 'lesson_1_sizing',
    title: 'The 1-2% Position Sizing Rule',
    category: 'Risk Management',
    readTime: '3 min',
    summary: 'Never risk more than 1% to 2% of total account equity on any single trade setup.',
    keyTakeaways: [
      'Position size should be determined by stop-loss distance, not account balance enthusiasm.',
      'A 10-trade losing streak at 1% risk results in an ~9.6% drawdown, which is recoverable.',
      'The same streak at 10% risk wipes out over 65% of your portfolio.'
    ]
  },
  {
    id: 'lesson_2_order_types',
    title: 'Controlling Slippage: Limit vs. Market Orders',
    category: 'Execution Discipline',
    readTime: '4 min',
    summary: 'Why disciplined market participants avoid chasing volatile breakouts with raw market orders.',
    keyTakeaways: [
      'Market orders prioritize immediate execution over execution price, accepting bid-ask spread slippage.',
      'Limit orders guarantee execution at your specified price or better, eliminating unpleasant fills.',
      'Patient resting orders near key liquidity levels protect capital during fast market sessions.'
    ]
  },
  {
    id: 'lesson_3_quantiles',
    title: 'Interpreting 21-Day AI Quantile Corridors',
    category: 'Quantitative Intelligence',
    readTime: '5 min',
    summary: 'How probabilistic Q10/Q90 cones quantify empirical dispersion rather than guaranteed price targets.',
    keyTakeaways: [
      'A point prediction without an uncertainty boundary is incomplete and misleading.',
      'The 80% interval between Q10 and Q90 represents the plausible range derived from historical volatility and fundamental filings.',
      'Elevated corridor width signals market regime turbulence where position sizes should be scaled down.'
    ]
  },
  {
    id: 'lesson_4_concentration',
    title: 'Sector Concentration & Correlation Traps',
    category: 'Portfolio Construction',
    readTime: '4 min',
    summary: 'Why holding 4 banking stocks is not true diversification, but a single leveraged sector bet.',
    keyTakeaways: [
      'Holding multiple companies in the same sector exposes the portfolio to common macroeconomic shocks.',
      'Aim for a maximum of 20% to 25% portfolio exposure to any single sector.',
      'True resilience comes from uncorrelated asset classes and defensive cash reserves.'
    ]
  },
  {
    id: 'lesson_5_journaling',
    title: 'Reflective Journaling: Removing Emotion from Trading',
    category: 'Psychology & Discipline',
    readTime: '3 min',
    summary: 'The single most effective exercise separating disciplined investors from impulsive retail traders.',
    keyTakeaways: [
      'Document your entry hypothesis and invalidation level before placing an order.',
      'Tagging your emotional state (calm vs. FOMO) prevents emotional tilt and revenge trades.',
      'Reviewing past winning and losing trades reveals structural biases and execution leaks.'
    ]
  },
  {
    id: 'lesson_6_drawdowns',
    title: 'Non-Linear Drawdown Mathematics',
    category: 'Capital Preservation',
    readTime: '4 min',
    summary: 'Why capital preservation is mathematically mandatory for long-term compound growth.',
    keyTakeaways: [
      'A 20% loss requires a 25% gain to break even.',
      'A 50% loss requires a 100% gain just to return to capital parity.',
      'The primary mandate of paper trading is learning how to survive adverse market cycles intact.'
    ]
  }
];

export function getCompletedLessons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LESSONS);
    return raw ? JSON.parse(raw) : ['lesson_1_sizing']; // Seed with lesson 1 completed in demo
  } catch (e) {
    return ['lesson_1_sizing'];
  }
}

export function saveCompletedLessons(lessonIds) {
  try {
    localStorage.setItem(STORAGE_KEY_LESSONS, JSON.stringify(lessonIds));
  } catch (e) {}
}

export function getJournalEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_JOURNAL);
    if (raw) return JSON.parse(raw);
    // Seed initial demo reflection note if none exists
    const demo = [
      {
        id: 'jnl_001',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        symbol: 'RELIANCE.NS',
        action: 'BUY',
        thesis: 'Accumulated near support baseline. Moving average trend is supportive and free cash flow generation is robust.',
        plannedRisk: 'Exit if daily close breaches ₹2,820 (-3.4% risk bound).',
        emotion: 'Calm & Objective',
        adheredToRules: true
      }
    ];
    return demo;
  } catch (e) {
    return [];
  }
}

export function saveJournalEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY_JOURNAL, JSON.stringify(entries));
  } catch (e) {}
}

/**
 * Evaluates real portfolio and platform data to determine risk discipline metrics.
 */
export function calculateRiskDiscipline(trading, completedLessons = [], journalEntries = []) {
  const positions = trading.positions || [];
  const orders = trading.orders || [];
  const user = trading.user || { balance: 0, initialBalance: 500000 };
  const portfolioValue = typeof trading.getTotalPortfolioValue === 'function'
    ? trading.getTotalPortfolioValue()
    : (user.balance || 0);

  // 1. Max Single-Position Concentration
  let maxConcentration = 0;
  let highestPositionSymbol = null;
  if (positions.length > 0 && portfolioValue > 0) {
    positions.forEach((pos) => {
      const val = Number(pos.marketValue || (pos.quantity * (pos.price || pos.avgPrice)) || 0);
      const pct = (val / portfolioValue) * 100;
      if (pct > maxConcentration) {
        maxConcentration = pct;
        highestPositionSymbol = pos.symbol;
      }
    });
  }

  // Concentration Rule: Ideal is <= 25%
  const isConcentrationSafe = positions.length === 0 || maxConcentration <= 25;

  // 2. Liquid Cash Reserve Ratio
  const cashReserveRatio = portfolioValue > 0 ? (Number(user.balance || 0) / portfolioValue) * 100 : 0;
  const isLiquiditySafe = cashReserveRatio >= 15; // At least 15% liquid buffer

  // 3. Execution Discipline (Limit Order Usage)
  const totalOrders = orders.length;
  const limitOrders = orders.filter((o) => String(o.type).toUpperCase() === 'LIMIT').length;
  const limitOrderRatio = totalOrders > 0 ? (limitOrders / totalOrders) * 100 : 100;
  const isExecutionDisciplined = totalOrders === 0 || limitOrderRatio >= 70;

  // 4. Sector Diversification
  const uniqueSectors = new Set();
  positions.forEach((p) => {
    if (p.sector) uniqueSectors.add(p.sector);
  });
  const sectorsCount = uniqueSectors.size;
  const isDiversified = positions.length <= 1 || sectorsCount >= 2;

  // 5. Educational Progress
  const lessonProgressPct = (completedLessons.length / CORE_LESSONS.length) * 100;

  // 6. Overall Composite Discipline Score (0 to 100)
  let score = 0;
  // Allocation health (up to 25 pts)
  if (positions.length === 0) score += 20;
  else if (maxConcentration <= 20) score += 25;
  else if (maxConcentration <= 25) score += 20;
  else if (maxConcentration <= 35) score += 10;
  else score += 5;

  // Liquidity health (up to 25 pts)
  if (cashReserveRatio >= 25) score += 25;
  else if (cashReserveRatio >= 15) score += 20;
  else if (cashReserveRatio >= 5) score += 10;
  else score += 0;

  // Order execution quality (up to 25 pts)
  if (totalOrders === 0) score += 20;
  else if (limitOrderRatio >= 80) score += 25;
  else if (limitOrderRatio >= 50) score += 15;
  else score += 5;

  // Learning & Journaling (up to 25 pts)
  const learningPts = Math.min(15, completedLessons.length * 2.5);
  const journalPts = Math.min(10, journalEntries.length * 5);
  score += Math.round(learningPts + journalPts);

  const clampedScore = Math.min(100, Math.max(0, score));

  // Determine discipline level
  let level = 'Beginner Observer';
  if (clampedScore >= 85) level = 'Institutional Prudence';
  else if (clampedScore >= 70) level = 'Disciplined Practitioner';
  else if (clampedScore >= 50) level = 'Developing Trader';

  return {
    portfolioValue,
    maxConcentration,
    highestPositionSymbol,
    isConcentrationSafe,
    cashReserveRatio,
    isLiquiditySafe,
    totalOrders,
    limitOrders,
    limitOrderRatio,
    isExecutionDisciplined,
    sectorsCount,
    isDiversified,
    lessonProgressPct,
    score: clampedScore,
    level
  };
}

/**
 * 8 Institutional Badges with transparent criteria and real data requirements.
 */
export function getAchievementBadges(trading, riskMetrics, completedLessons = [], journalEntries = []) {
  const orders = trading.orders || [];
  const positions = trading.positions || [];
  const watchlist = trading.watchlist || [];
  const hasPrediction = !!trading.prediction;

  return [
    {
      id: 'badge_prudent_sizer',
      name: 'Prudent Sizer',
      category: 'Risk Management',
      icon: '🛡️',
      description: 'Maintain maximum position concentration under 25% of total portfolio value.',
      criteria: 'Max single position <= 25% of portfolio',
      unlocked: positions.length > 0 && riskMetrics.maxConcentration <= 25,
      progress: positions.length === 0 ? 'No open positions' : `${riskMetrics.maxConcentration.toFixed(1)}% (Threshold: ≤ 25%)`,
      progressPct: positions.length === 0 ? 0 : riskMetrics.maxConcentration <= 25 ? 100 : Math.max(10, Math.round((25 / Math.max(1, riskMetrics.maxConcentration)) * 100)),
      unlockedNotice: 'Safeguarded against catastrophic single-stock risk.'
    },
    {
      id: 'badge_order_discipline',
      name: 'Order Discipline',
      category: 'Execution Quality',
      icon: '🎯',
      description: 'Execute trades using LIMIT orders to prevent market-order slippage.',
      criteria: 'At least 1 limit order submitted',
      unlocked: orders.some((o) => String(o.type).toUpperCase() === 'LIMIT'),
      progress: `${riskMetrics.limitOrders} limit orders placed`,
      progressPct: riskMetrics.limitOrders > 0 ? 100 : 0,
      unlockedNotice: 'Prioritizing execution price certainty over impulsive market chasing.'
    },
    {
      id: 'badge_diversified_core',
      name: 'Diversification Core',
      category: 'Portfolio Construction',
      icon: '🌐',
      description: 'Hold active positions spanning 2 or more distinct economic sectors.',
      criteria: 'Positions held across ≥ 2 sectors',
      unlocked: riskMetrics.sectorsCount >= 2,
      progress: `${riskMetrics.sectorsCount} of 2 required sectors represented`,
      progressPct: Math.min(100, Math.round((riskMetrics.sectorsCount / 2) * 100)),
      unlockedNotice: 'Portfolio insulated against idiosyncratic sector shocks.'
    },
    {
      id: 'badge_liquidity_guard',
      name: 'Liquidity Guard',
      category: 'Capital Management',
      icon: '💧',
      description: 'Preserve at least 15% liquid unallocated cash buffer to capitalize on pullbacks.',
      criteria: 'Liquid cash reserve ≥ 15%',
      unlocked: riskMetrics.cashReserveRatio >= 15,
      progress: `${riskMetrics.cashReserveRatio.toFixed(1)}% cash reserve (Target: ≥ 15%)`,
      progressPct: Math.min(100, Math.round((riskMetrics.cashReserveRatio / 15) * 100)),
      unlockedNotice: 'Dry powder preserved for opportunistic value entries.'
    },
    {
      id: 'badge_quant_reader',
      name: 'Quantitative Reader',
      category: 'Market Intelligence',
      icon: '📈',
      description: 'Evaluate an AI 21-day probabilistic price forecast and quantile corridor.',
      criteria: 'Analyze an asset with the 21D ML model',
      unlocked: hasPrediction,
      progress: hasPrediction ? 'Evaluated' : 'Awaiting first forecast review',
      progressPct: hasPrediction ? 100 : 0,
      unlockedNotice: 'Grounded decision in mathematical dispersion, not intuition.'
    },
    {
      id: 'badge_market_explorer',
      name: 'Market Explorer',
      category: 'Discovery Habits',
      icon: '🔭',
      description: 'Curate a disciplined market watchlist with 3 or more tracked equities.',
      criteria: 'Watchlist contains ≥ 3 symbols',
      unlocked: watchlist.length >= 3,
      progress: `${watchlist.length} of 3 symbols configured`,
      progressPct: Math.min(100, Math.round((watchlist.length / 3) * 100)),
      unlockedNotice: 'Monitoring targeted setups rather than wandering the market.'
    },
    {
      id: 'badge_academy_scholar',
      name: 'Academy Scholar',
      category: 'Continuous Learning',
      icon: '🎓',
      description: 'Complete all 6 risk-management and market-discipline educational modules.',
      criteria: 'Complete 6 educational lessons',
      unlocked: completedLessons.length >= CORE_LESSONS.length,
      progress: `${completedLessons.length} of ${CORE_LESSONS.length} modules completed`,
      progressPct: Math.min(100, Math.round((completedLessons.length / CORE_LESSONS.length) * 100)),
      unlockedNotice: 'Firm theoretical foundation in capital preservation established.'
    },
    {
      id: 'badge_trade_journalist',
      name: 'Reflective Journalist',
      category: 'Trading Psychology',
      icon: '✍️',
      description: 'Log at least one structured trade rationale and risk thesis in the journal.',
      criteria: 'Record ≥ 1 reflective journal entry',
      unlocked: journalEntries.length >= 1,
      progress: `${journalEntries.length} reflection entries recorded`,
      progressPct: Math.min(100, Math.round((journalEntries.length / 1) * 100)),
      unlockedNotice: 'Documenting pre-trade hypotheses to eliminate emotional hindsight bias.'
    }
  ];
}

