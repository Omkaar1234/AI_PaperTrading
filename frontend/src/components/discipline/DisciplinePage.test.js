import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  calculateRiskDiscipline,
  getAchievementBadges,
  CORE_LESSONS,
  getCompletedLessons,
  getJournalEntries
} from './disciplineUtils';
import DisciplineHeader from './DisciplineHeader';
import RiskDisciplineMeter from './RiskDisciplineMeter';
import AchievementBadges from './AchievementBadges';
import LearningModules from './LearningModules';
import TradingJournal from './TradingJournal';
import DisciplineWidget from '../dashboard/DisciplineWidget';
import DisciplinePage from '../../pages/DisciplinePage';

describe('Phase 4: Trading Discipline & Responsible Gamification Suite', () => {
  const mockUser = {
    balance: 150000,
    initialBalance: 500000
  };

  const mockPositions = [
    {
      symbol: 'RELIANCE.NS',
      quantity: 100,
      price: 2900,
      marketValue: 290000,
      sector: 'Energy'
    },
    {
      symbol: 'TCS.NS',
      quantity: 50,
      price: 3800,
      marketValue: 190000,
      sector: 'Technology'
    }
  ];

  const mockOrders = [
    { id: '1', symbol: 'RELIANCE.NS', type: 'LIMIT', status: 'FILLED' },
    { id: '2', symbol: 'TCS.NS', type: 'LIMIT', status: 'FILLED' },
    { id: '3', symbol: 'INFY.NS', type: 'MARKET', status: 'FILLED' }
  ];

  const mockTrading = {
    user: mockUser,
    positions: mockPositions,
    orders: mockOrders,
    getTotalPortfolioValue: () => 630000,
    prediction: { symbol: 'RELIANCE.NS', signal: 'UP' }
  };

  describe('disciplineUtils calculations', () => {
    test('computes honest, non-fabricated metrics for portfolio', () => {
      const completedLessons = ['lesson_1_sizing', 'lesson_2_order_types'];
      const journalEntries = [{ id: 'j1', symbol: 'RELIANCE.NS' }];

      const metrics = calculateRiskDiscipline(mockTrading, completedLessons, journalEntries);

      // Total portfolio value: 630,000
      // Max concentration: 290,000 / 630,000 = ~46.03% (RELIANCE)
      // Cash buffer: 150,000 / 630,000 = ~23.81%
      // Orders: 2 limit out of 3 total = 66.7% limit order ratio
      // Sectors: 2 unique (Energy, Technology)

      expect(metrics.portfolioValue).toBe(630000);
      expect(metrics.maxConcentration).toBeCloseTo(46.03, 1);
      expect(metrics.highestPositionSymbol).toBe('RELIANCE.NS');
      expect(metrics.isConcentrationSafe).toBe(false); // > 25%
      expect(metrics.cashReserveRatio).toBeCloseTo(23.81, 1);
      expect(metrics.isLiquiditySafe).toBe(true); // >= 15%
      expect(metrics.limitOrderRatio).toBeCloseTo(66.67, 1);
      expect(metrics.sectorsCount).toBe(2);
      expect(metrics.isDiversified).toBe(true);

      // Score must be in 0-100 range
      expect(metrics.score).toBeGreaterThanOrEqual(0);
      expect(metrics.score).toBeLessThanOrEqual(100);
      expect(metrics.level).toBeDefined();
    });

    test('handles empty or zero-balance portfolio gracefully without NaN or casino score', () => {
      const emptyTrading = {
        user: { balance: 0 },
        positions: [],
        orders: [],
        getTotalPortfolioValue: () => 0
      };

      const metrics = calculateRiskDiscipline(emptyTrading, [], []);
      expect(metrics.portfolioValue).toBe(0);
      expect(metrics.maxConcentration).toBe(0);
      expect(metrics.cashReserveRatio).toBe(0);
      expect(metrics.limitOrderRatio).toBe(100); // 0 orders -> default 100%
      expect(metrics.sectorsCount).toBe(0);
      expect(metrics.score).toBeGreaterThanOrEqual(0);
      expect(metrics.score).toBeLessThanOrEqual(100);
    });

    test('verifies all 8 badges have transparent, non-casino evaluation rules', () => {
      const metrics = calculateRiskDiscipline(mockTrading, [], []);
      const badges = getAchievementBadges(mockTrading, metrics, [], []);

      expect(badges).toHaveLength(8);

      badges.forEach((badge) => {
        expect(badge.id).toBeDefined();
        expect(badge.name).toBeDefined();
        expect(badge.category).toBeDefined();
        expect(badge.description).toBeDefined();
        expect(badge.criteria).toBeDefined();
        expect(typeof badge.unlocked).toBe('boolean');
      });

      // Verify specific badge names exist
      const badgeNames = badges.map(b => b.name);
      expect(badgeNames).toContain('Prudent Sizer');
      expect(badgeNames).toContain('Order Discipline');
      expect(badgeNames).toContain('Diversification Core');
      expect(badgeNames).toContain('Liquidity Guard');
      expect(badgeNames).toContain('Quantitative Reader');
      expect(badgeNames).toContain('Market Explorer');
      expect(badgeNames).toContain('Academy Scholar');
      expect(badgeNames).toContain('Reflective Journalist');
    });

    test('verifies core educational lessons cover fundamental risk and execution topics', () => {
      expect(CORE_LESSONS.length).toBe(6);

      CORE_LESSONS.forEach((lesson) => {
        expect(lesson.id).toBeDefined();
        expect(lesson.title).toBeDefined();
        expect(lesson.category).toBeDefined();
        expect(lesson.summary).toBeDefined();
        expect(lesson.keyTakeaways.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Component Rendering via ReactDOMServer', () => {
    test('renders DisciplineHeader with responsible notice and score gauge', () => {
      const metrics = calculateRiskDiscipline(mockTrading, [], []);
      const html = ReactDOMServer.renderToString(
        <DisciplineHeader
          riskMetrics={metrics}
          completedLessonsCount={2}
          totalLessonsCount={6}
        />
      );

      expect(html).toContain('Responsible Engagement Framework');
      expect(html).toContain('Discipline &amp; Learning Index');
      expect(html).toContain('/100');
      expect(html).toContain('Max Position Size');
      expect(html).toContain('Cash Buffer');
      expect(html).toContain('Limit Order Ratio');
      expect(html).toContain('Target: ≤ 25.0%');
    });

    test('renders RiskDisciplineMeter with institutional benchmarks', () => {
      const metrics = calculateRiskDiscipline(mockTrading, [], []);
      const html = ReactDOMServer.renderToString(
        <RiskDisciplineMeter riskMetrics={metrics} positions={mockPositions} />
      );

      expect(html).toContain('Risk Architecture');
      expect(html).toContain('Risk Limits &amp; Execution Quality');
      expect(html).toContain('Position Concentration');
      expect(html).toContain('25% Max');
      expect(html).toContain('Liquidity Buffer');
      expect(html).toContain('Limit Order Discipline');
      expect(html).toContain('Sector Breadth');
    });

    test('renders AchievementBadges with verified badges and transparent criteria', () => {
      const metrics = calculateRiskDiscipline(mockTrading, [], []);
      const badges = getAchievementBadges(mockTrading, metrics, [], []);
      const html = ReactDOMServer.renderToString(
        <AchievementBadges badges={badges} />
      );

      expect(html).toContain('Verifiable Milestones');
      expect(html).toContain('Discipline &amp; Risk Badges');
      expect(html).toContain('Prudent Sizer');
      expect(html).toContain('Order Discipline');
      expect(html).toContain('All (<!-- -->8<!-- -->)');
    });

    test('renders LearningModules with structured curriculum', () => {
      const html = ReactDOMServer.renderToString(
        <LearningModules
          completedLessons={['lesson_1_sizing']}
          onToggleLesson={() => {}}
        />
      );

      expect(html).toContain('Risk Management &amp; Execution Academy');
      expect(html).toContain('Course Progress:');
      expect(html).toContain('The 1-2% Position Sizing Rule');
      expect(html).toContain('Controlling Slippage: Limit vs. Market Orders');
      expect(html).toContain('Key Core Takeaways');
    });

    test('renders TradingJournal with pre-trade reflection UI', () => {
      const html = ReactDOMServer.renderToString(
        <TradingJournal
          entries={[]}
          onAddEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      expect(html).toContain('Discipline Trading Journal');
      expect(html).toContain('+ Log Trade Reflection');
      expect(html).toContain('Your Trading Journal is Empty');
    });

    test('renders DisciplineWidget for Dashboard integration with MemoryRouter', () => {
      const html = ReactDOMServer.renderToString(
        <MemoryRouter>
          <DisciplineWidget trading={mockTrading} />
        </MemoryRouter>
      );

      expect(html).toContain('Trader discipline');
      expect(html).toContain('Habits &amp; Risk Limits');
      expect(html).toContain('Max Position Size');
      expect(html).toContain('Execution Quality');
      expect(html).toContain('Open Discipline Hub →');
    });

    test('renders full DisciplinePage with MemoryRouter', () => {
      const html = ReactDOMServer.renderToString(
        <MemoryRouter>
          <DisciplinePage trading={mockTrading} />
        </MemoryRouter>
      );

      expect(html).toContain('Responsible Engagement Framework');
      expect(html).toContain('Risk Architecture');
      expect(html).toContain('Verifiable Milestones');
      expect(html).toContain('Risk Management &amp; Execution Academy');
      expect(html).toContain('Discipline Trading Journal');
      expect(html).toContain('UPRISE Responsible Trading Guarantee:');
    });
  });
});
