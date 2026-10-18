import React, { useState } from 'react';
import { CORE_LESSONS } from './disciplineUtils';

function LearningModules({ completedLessons = [], onToggleLesson }) {
  const [expandedLessonId, setExpandedLessonId] = useState(CORE_LESSONS[0]?.id || null);

  const completedCount = completedLessons.length;
  const totalCount = CORE_LESSONS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section className="card learning-modules-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Institutional Curriculum</span>
          <h3>Risk Management & Execution Academy</h3>
          <p className="section-subtext">
            Complete foundational coursework in position sizing, spread slippage, AI quantiles, and portfolio drawdown control.
          </p>
        </div>

        <div className="curriculum-progress-badge">
          <div className="curriculum-progress-labels">
            <span>Course Progress:</span>
            <strong>{completedCount} / {totalCount} ({progressPct}%)</strong>
          </div>
          <div className="curriculum-progress-track">
            <div
              className="curriculum-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="lessons-list">
        {CORE_LESSONS.map((lesson, idx) => {
          const isCompleted = completedLessons.includes(lesson.id);
          const isExpanded = expandedLessonId === lesson.id;

          return (
            <article
              key={lesson.id}
              className={`lesson-card ${isCompleted ? 'lesson-completed' : ''} ${isExpanded ? 'lesson-expanded' : ''}`}
            >
              <div
                className="lesson-card-header"
                onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedLessonId(isExpanded ? null : lesson.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                <div className="lesson-header-left">
                  <span className="lesson-index-tag">Module {idx + 1}</span>
                  <div className="lesson-titles">
                    <h4 className="lesson-title">{lesson.title}</h4>
                    <span className="lesson-meta">{lesson.category} • {lesson.readTime} read</span>
                  </div>
                </div>

                <div className="lesson-header-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`lesson-complete-toggle-btn ${isCompleted ? 'is-done' : ''}`}
                    onClick={() => onToggleLesson(lesson.id)}
                    aria-label={`Mark ${lesson.title} as ${isCompleted ? 'incomplete' : 'completed'}`}
                  >
                    {isCompleted ? '✓ Completed' : 'Mark as Studied'}
                  </button>
                  <button
                    type="button"
                    className="lesson-expand-btn"
                    onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                    aria-label={isExpanded ? 'Collapse module details' : 'Expand module details'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              <div className="lesson-card-summary">
                <p>{lesson.summary}</p>
              </div>

              {isExpanded && (
                <div className="lesson-card-details">
                  <h5 className="takeaways-title">Key Core Takeaways</h5>
                  <ul className="takeaways-list">
                    {lesson.keyTakeaways.map((item, i) => (
                      <li key={i} className="takeaway-item">
                        <span className="takeaway-bullet">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default LearningModules;

