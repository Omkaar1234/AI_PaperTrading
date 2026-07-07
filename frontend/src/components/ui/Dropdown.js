import React from 'react';

function Dropdown({ label, children, className = '' }) {
  return (
    <details className={`ui-dropdown ${className}`.trim()}>
      <summary>{label}</summary>
      <div className="ui-dropdown-panel">{children}</div>
    </details>
  );
}

export default Dropdown;
