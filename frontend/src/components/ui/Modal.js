import React from 'react';

function Modal({ open, title, children, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ui-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="ui-modal-header">
          <h2>{title}</h2>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default Modal;
