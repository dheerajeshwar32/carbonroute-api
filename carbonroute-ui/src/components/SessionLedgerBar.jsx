import React, { useState } from 'react';

export function SessionLedgerBar({ ledger, onExport, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);

  if (!ledger || ledger.totalRequests === 0) {
    return null;
  }

  const handleResetClick = () => {
    if (confirmReset) {
      onReset();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
    }
  };

  return (
    <div className="glass-panel ledger-bar spring-enter">
      <div className="ledger-metrics">
        <div className="ledger-stat-item">
          <span className="ledger-label">Session Queries</span>
          <span className="ledger-val tabular-numbers">{ledger.totalRequests}</span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">Cache Hit Ratio</span>
          <span className="ledger-val tabular-numbers" style={{ color: ledger.cacheHitRatio > 0 ? 'var(--accent-green)' : 'inherit' }}>
            {ledger.cacheHitRatio}%
          </span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">Total CO₂e Saved vs. Worst Grid</span>
          <span className="ledger-val tabular-numbers" style={{ color: 'var(--accent-green)' }}>
            {ledger.cumulativeEmissionsSavedG.toFixed(4)} <span style={{ fontSize: '12px', fontWeight: 500 }}>g</span>
          </span>
        </div>
      </div>

      <div className="ledger-actions">
        <button
          type="button"
          onClick={onExport}
          className="btn-ledger-action"
          title="Export complete session telemetry as JSON"
        >
          <span>⬇ Export JSON</span>
        </button>

        <button
          type="button"
          onClick={handleResetClick}
          className={`btn-ledger-action ${confirmReset ? 'confirm-danger' : ''}`}
          title={confirmReset ? 'Click again to confirm reset' : 'Reset session statistics'}
        >
          <span>{confirmReset ? 'Confirm Reset?' : 'Reset'}</span>
        </button>
      </div>
    </div>
  );
}
