import React, { useState } from 'react';
import DisciplineHeader from '../components/discipline/DisciplineHeader';
import RiskDisciplineMeter from '../components/discipline/RiskDisciplineMeter';
import AchievementBadges from '../components/discipline/AchievementBadges';
import LearningModules from '../components/discipline/LearningModules';
import TradingJournal from '../components/discipline/TradingJournal';
import {
  CORE_LESSONS,
  calculateRiskDiscipline,
  getAchievementBadges,
  getCompletedLessons,
  getJournalEntries,
  saveCompletedLessons,
  saveJournalEntries
} from '../components/discipline/disciplineUtils';

function DisciplinePage({ trading }) {
  const [completedLessons, setCompletedLessons] = useState(() => getCompletedLessons());
  const [journalEntries, setJournalEntries] = useState(() => getJournalEntries());

  const handleToggleLesson = (lessonId) => {
    setCompletedLessons((prev) => {
      const exists = prev.includes(lessonId);
      const next = exists ? prev.filter((id) => id !== lessonId) : [...prev, lessonId];
      saveCompletedLessons(next);
      return next;
    });
  };

  const handleAddJournalEntry = (newEntry) => {
    setJournalEntries((prev) => {
      const next = [newEntry, ...prev];
      saveJournalEntries(next);
      return next;
    });
  };

  const handleDeleteJournalEntry = (entryId) => {
    setJournalEntries((prev) => {
      const next = prev.filter((e) => e.id !== entryId);
      saveJournalEntries(next);
      return next;
    });
  };

  const riskMetrics = calculateRiskDiscipline(trading, completedLessons, journalEntries);
  const badges = getAchievementBadges(trading, riskMetrics, completedLessons, journalEntries);

  return (
    <div className="page discipline-page">
      {/* 1. Header with Discipline Index & Responsible Engagement Notice */}
      <DisciplineHeader
        riskMetrics={riskMetrics}
        completedLessonsCount={completedLessons.length}
        totalLessonsCount={CORE_LESSONS.length}
      />

      {/* 2. Real Verified Risk Limits & Execution Quality Meter */}
      <RiskDisciplineMeter
        riskMetrics={riskMetrics}
        positions={trading.positions || []}
      />

      {/* 3. Verifiable Discipline & Risk Badges */}
      <AchievementBadges badges={badges} />

      {/* 4. Financial & Risk Management Academy */}
      <LearningModules
        completedLessons={completedLessons}
        onToggleLesson={handleToggleLesson}
      />

      {/* 5. Reflective Pre-Trade Trading Journal */}
      <TradingJournal
        entries={journalEntries}
        onAddEntry={handleAddJournalEntry}
        onDeleteEntry={handleDeleteJournalEntry}
      />

      {/* 6. Institutional Compliance & Education Disclaimer */}
      <footer className="discipline-footer-note">
        <p>
          <strong>UPRISE Responsible Trading Guarantee:</strong> Paper trading is an educational simulation designed to build psychological discipline and risk awareness. Simulated performance does not guarantee future results in live capital markets. Always preserve capital first.
        </p>
      </footer>
    </div>
  );
}

export default DisciplinePage;

