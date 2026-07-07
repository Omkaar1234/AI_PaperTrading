import React from 'react';

function Badge({ children, className = '', tone = 'neutral', ...props }) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export default Badge;
