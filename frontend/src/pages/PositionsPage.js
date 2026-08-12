import React from 'react';
import PositionsTable from '../components/PositionsTable';

function PositionsPage({ trading }) {
  return (
    <div className="page stack">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Portfolio holdings</p>
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
