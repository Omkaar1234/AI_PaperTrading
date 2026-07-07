import React from 'react';

function Sparkline({ values = [], tone = 'positive' }) {
  const safeValues = values.length ? values : [48, 52, 49, 55, 53, 58, 56, 61];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(1, safeValues.length - 1)) * 100;
      const y = 34 - ((value - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={`dashboard-sparkline ${tone}`} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default Sparkline;
