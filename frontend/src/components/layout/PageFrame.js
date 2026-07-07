import React from 'react';

function PageFrame({ children, description, tradeSuccess }) {
  return (
    <div className="page-frame">
      <div className="page-frame-header">
        {description ? <p className="page-frame-description">{description}</p> : null}
      </div>

      {tradeSuccess ? (
        <div className={`banner banner-${tradeSuccess.type}`}>
          {tradeSuccess.message}
        </div>
      ) : null}

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default PageFrame;
