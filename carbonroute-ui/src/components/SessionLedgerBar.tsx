import { useEffect, useRef, useState } from 'react';
import type { SessionLedgerSummary } from '../types/contract';

export interface SessionLedgerBarProps {
  ledger: SessionLedgerSummary;
  onExport: () => void;
  onReset: () => void;
}

export function SessionLedgerBar({ ledger, onExport, onReset }: SessionLedgerBarProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const isEmpty = ledger.totalRequests === 0;

  const handleResetClick = () => {
    if (confirmReset) {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      onReset();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmReset(false);
        confirmTimerRef.current = null;
      }, 4000);
    }
  };

  return (
    <section className="glass-panel ledger-bar spring-enter" aria-label="Session carbon impact ledger">
      <div className="ledger-metrics">
        <div className="ledger-stat-item">
          <span className="ledger-label">Queries Routed</span>
          <span className="ledger-val tabular-numbers">{ledger.totalRequests}</span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">Cache Hit Ratio</span>
          <span
            className="ledger-val tabular-numbers"
            style={{ color: ledger.cacheHitRatio > 0 ? 'var(--accent-green)' : 'inherit' }}
          >
            {ledger.cacheHitRatio}%
          </span>
        </div>

        <div className="ledger-divider" />

        <div className="ledger-stat-item">
          <span className="ledger-label">CO₂e Avoided</span>
          <span className="ledger-val tabular-numbers" style={{ color: 'var(--accent-green)' }}>
            {ledger.cumulativeEmissionsSavedG.toFixed(4)}{' '}
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
          style={isEmpty ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
        >
          <span>⬇ Export JSON</span>
        </button>

        <button
          type="button"
          onClick={handleResetClick}
          disabled={isEmpty}
          className={`btn-ledger-action ${confirmReset ? 'confirm-danger' : ''}`}
          title={confirmReset ? 'Click again to confirm reset' : 'Reset session statistics'}
          style={isEmpty ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
        >
          <span>{confirmReset ? 'Confirm Reset?' : 'Reset'}</span>
        </button>
      </div>
    </section>
  );
}
