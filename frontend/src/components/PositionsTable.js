import React from 'react';
import { formatINR } from '../constants';

function PositionsTable({ positions, selectAsset, embedded = false }) {
  return (
    <section className={embedded ? '' : 'card'}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Holdings</p>
          <h3>Open Positions</h3>
        </div>
      </div>

      <div className="data-table">
        <div className="table-head neutral five">
          <span>Asset</span>
          <span>Qty</span>
          <span>Avg Price</span>
          <span>Invested</span>
          <span>Action</span>
        </div>
        {positions.length ? (
          positions.map((position) => (
            <div className="table-row neutral five" key={position.symbol}>
              <span>{position.symbol}</span>
              <span>{position.quantity}</span>
              <span>{formatINR(position.avgPrice)}</span>
              <span>{formatINR(position.invested)}</span>
              <button className="table-action" onClick={() => selectAsset({ symbol: position.symbol, name: position.symbol, price: position.avgPrice })}>
                View
              </button>
            </div>
          ))
        ) : (
          <div className="empty-panel">No positions yet.</div>
        )}
      </div>
    </section>
  );
}

export default PositionsTable;
