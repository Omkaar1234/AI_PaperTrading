import React, { useState } from 'react';

const EMOTIONAL_STATES = [
  'Calm & Objective',
  'Cautious & Analytical',
  'Focused on Process',
  'Restless / Impulsive (Caution)',
  'Fearful / Hesitant'
];

function TradingJournal({ entries = [], onAddEntry, onDeleteEntry }) {
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [action, setAction] = useState('BUY');
  const [thesis, setThesis] = useState('');
  const [plannedRisk, setPlannedRisk] = useState('');
  const [emotion, setEmotion] = useState(EMOTIONAL_STATES[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!thesis.trim()) return;

    const newEntry = {
      id: `jnl_${Date.now()}`,
      timestamp: new Date().toISOString(),
      symbol: symbol.trim().toUpperCase(),
      action,
      thesis: thesis.trim(),
      plannedRisk: plannedRisk.trim() || 'Stop at invalidation level based on risk boundaries.',
      emotion,
      adheredToRules: true
    };

    onAddEntry(newEntry);
    setThesis('');
    setPlannedRisk('');
    setShowForm(false);
  };

  return (
    <section className="card trading-journal-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Trade Reflection</span>
          <h3>Discipline Trading Journal</h3>
          <p className="section-subtext">
            Document trade rationales, risk bounds, and mental state prior to execution to eliminate emotional hindsight bias.
          </p>
        </div>

        <button
          type="button"
          className="primary-button add-journal-entry-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel Note' : '+ Log Trade Reflection'}
        </button>
      </div>

      {/* Entry Creation Form */}
      {showForm && (
        <form className="journal-entry-form" onSubmit={handleSubmit}>
          <h4 className="form-subheading">New Trade Reflection Note</h4>

          <div className="form-row-paired">
            <div className="form-group">
              <label htmlFor="journal-symbol">Instrument Symbol</label>
              <input
                id="journal-symbol"
                type="text"
                className="journal-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. TCS.NS, RELIANCE.NS"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="journal-action">Trade Intent</label>
              <select
                id="journal-action"
                className="journal-select"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="BUY">BUY / Long Entry</option>
                <option value="SELL">SELL / Short Entry</option>
                <option value="OBSERVE">OBSERVE / Wait for Setup</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="journal-emotion">Mental & Emotional State</label>
              <select
                id="journal-emotion"
                className="journal-select"
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
              >
                {EMOTIONAL_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="journal-thesis">Trade Hypothesis & Edge (Why am I taking this position?)</label>
            <textarea
              id="journal-thesis"
              className="journal-textarea"
              rows={3}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="Detail technical moving average baseline, fundamental catalyst, or AI quantile corridor rationale..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="journal-risk">Pre-Defined Risk Boundary (Where is my exit/stop?)</label>
            <input
              id="journal-risk"
              type="text"
              className="journal-input"
              value={plannedRisk}
              onChange={(e) => setPlannedRisk(e.target.value)}
              placeholder="e.g. Exit if daily candle closes below ₹3,750 (-2.4% max loss)"
            />
          </div>

          <div className="form-submit-row">
            <button type="submit" className="primary-button save-journal-btn">
              Save Reflection Entry
            </button>
          </div>
        </form>
      )}

      {/* Entry History List or Empty State */}
      <div className="journal-entries-container">
        {entries.length === 0 ? (
          <div className="journal-empty-state">
            <span className="empty-icon">📖</span>
            <h4>Your Trading Journal is Empty</h4>
            <p>
              Documenting your trade rationale and invalidation level before entering a position is the #1 habit separating disciplined investors from emotional retail traders. Log your first reflection above.
            </p>
          </div>
        ) : (
          <div className="journal-entries-list">
            {entries.map((entry) => (
              <article key={entry.id} className="journal-entry-card">
                <div className="entry-header">
                  <div className="entry-header-left">
                    <span className={`entry-action-tag ${entry.action.toLowerCase()}`}>
                      {entry.action}
                    </span>
                    <strong className="entry-symbol">{entry.symbol}</strong>
                    <span className="entry-date">
                      {new Date(entry.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="entry-header-right">
                    <span className="entry-emotion-chip">
                      {entry.emotion}
                    </span>
                    {onDeleteEntry && (
                      <button
                        type="button"
                        className="entry-delete-btn"
                        onClick={() => onDeleteEntry(entry.id)}
                        aria-label="Delete journal entry"
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="entry-content">
                  <div className="entry-block">
                    <span className="entry-block-label">Hypothesis & Edge:</span>
                    <p className="entry-thesis">{entry.thesis}</p>
                  </div>

                  {entry.plannedRisk && (
                    <div className="entry-block risk-block">
                      <span className="entry-block-label">Planned Risk Boundary:</span>
                      <p className="entry-risk">{entry.plannedRisk}</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default TradingJournal;

