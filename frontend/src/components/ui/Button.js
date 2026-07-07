import React from 'react';

function Button({ children, className = '', variant = 'secondary', size = 'md', icon, ...props }) {
  return (
    <button className={`ui-button ui-button-${variant} ui-button-${size} ${className}`.trim()} {...props}>
      {icon ? <span className="ui-button-icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export default Button;
