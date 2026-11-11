import React, { useState } from 'react';

export function SessionLedgerBar({ ledger, onExport, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const safeLedger = ledger || {
    totalRequests: 0,
    cacheHitRatio: 0,
    cumulativeEmissionsSavedG: 0,
    history: [],
  };

  const isEmpty = safeLedger.totalRequests === 0;

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
          <span className="ledger-label">Queries Routed</span>
          <span className="ledger-val tabular-numbers">{safeLedger.totalRequests}</span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">Cache Hit Ratio</span>
          <span
            className="ledger-val tabular-numbers"
            style={{ color: safeLedger.cacheHitRatio > 0 ? 'var(--accent-green)' : 'inherit' }}
          >
            {safeLedger.cacheHitRatio}%
          </span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">CO₂e Avoided</span>
          <span className="ledger-val tabular-numbers" style={{ color: 'var(--accent-green)' }}>
            {safeLedger.cumulativeEmissionsSavedG.toFixed(4)}{' '}
            <span style={{ fontSize: '11px', fontWeight: 500 }}>gCO₂e</span>
          </span>
        </div>

        {isEmpty && (
          <>
            <div className="ledger-divider" />
            <div className="ledger-stat-item" style={{ opacity: 0.65, fontSize: '12px', fontStyle: 'italic' }}>
              <span>Ready to record session telemetry</span>
            </div>
          </>
        )}
      </div>

      <div className="ledger-actions">
        <button
          type="button"
          onClick={onExport}
          disabled={isEmpty}
          className="btn-ledger-action"
          title={isEmpty ? 'No telemetry recorded yet' : 'Export complete session telemetry as JSON'}
          style={isEmpty ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
        >
          <span>⬇ Export JSON</span>
        </button>

        <button
          type="button"
          onClick={handleResetClick}
          disabled={isEmpty}
          className={`btn-ledger-action ${confirmReset ? 'confirm-danger' : ''}`}
          title={confirmReset ? 'Click again to confirm reset' : 'Reset session statistics'}
          style={isEmpty ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
        >
          <span>{confirmReset ? 'Confirm Reset?' : 'Reset'}</span>
        </button>
      </div>
    </div>
  );
}
