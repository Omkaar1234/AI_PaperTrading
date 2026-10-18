import React from 'react';
import PositionsTable from '../components/PositionsTable';

function PositionsPage({ trading }) {
  return (
    <div className="page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Portfolio Holdings</p>
          <h2>Positions</h2>
          <p className="page-subtext">Track active positions, current market value, and instrument-level P&L.</p>
        </div>
        <button className="secondary-button" onClick={trading.fetchPositions}>
          Refresh Positions
        </button>
      </div>

      <PositionsTable positions={trading.positions} selectAsset={trading.selectAsset} />
    </div>
  );
}

export default PositionsPage;
