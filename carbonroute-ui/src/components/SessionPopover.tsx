import { useEffect, useRef, useState } from 'react';
import type { SessionLedgerSummary } from '../types/contract';
import { Download, Trash2, X } from './Icons';

export interface SessionPopoverProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  ledger: SessionLedgerSummary;
  onExport: () => void;
  onReset: () => void;
}

export function SessionPopover({
  id,
  isOpen,
  onClose,
  anchorRef,
  ledger,
  onExport,
  onReset,
}: SessionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConfirmReset(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        anchorRef.current?.focus();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

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
    <div
      id={id}
      ref={popoverRef}
      className="session-popover"
      role="dialog"
      aria-label="Session carbon impact ledger"
    >
      <div className="popover-header">
        <div>
          <h2 className="popover-title">Session Impact Ledger</h2>
          <p className="popover-subtitle">Persisted locally in browser storage</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close session ledger"
        >
          <X size={14} />
        </button>
      </div>

      <div className="popover-metrics-grid">
        <div className="popover-metric-cell">
          <span className="metric-label">Queries</span>
          <span className="metric-value mono-tabular">{ledger.totalRequests}</span>
        </div>
        <div className="popover-metric-cell">
          <span className="metric-label">Cache Hit</span>
          <span className="metric-value mono-tabular accent-sky">{ledger.cacheHitRatio}%</span>
        </div>
        <div className="popover-metric-cell">
          <span className="metric-label">CO₂e Avoided</span>
          <span className="metric-value mono-tabular accent-mint">
            {ledger.cumulativeEmissionsSavedG.toFixed(3)} gCO₂e
          </span>
        </div>
        <div className="popover-metric-cell">
          <span className="metric-label">Generated</span>
          <span className="metric-value mono-tabular">
            {ledger.cumulativeEmissionsGeneratedG.toFixed(3)} gCO₂e
          </span>
        </div>
      </div>

      <div className="popover-history-section">
        <div className="popover-section-label">Recent Dispatches</div>
        {isEmpty ? (
          <div className="popover-empty">
            No routed prompts recorded in this browser session yet.
          </div>
        ) : (
          <ul className="popover-history-list">
            {ledger.history.slice(0, 6).map((item) => (
              <li key={item.id} className="popover-history-item">
                <div className="history-prompt" title={item.prompt}>
                  {item.prompt}
                </div>
                <div className="history-meta mono-tabular">
                  <span className={item.cacheHit ? 'accent-sky' : 'text-secondary'}>
                    {item.cacheHit ? 'cache' : item.routedTo}
                  </span>
                  <span className="accent-mint">-{item.emissionsSavedG.toFixed(3)} gCO₂e</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="popover-footer">
        <button
          type="button"
          onClick={onExport}
          disabled={isEmpty}
          className="btn-secondary"
        >
          <Download size={13} />
          <span>Export JSON</span>
        </button>
        <button
          type="button"
          onClick={handleResetClick}
          disabled={isEmpty}
          className={`btn-secondary ${confirmReset ? 'btn-danger-outline' : ''}`}
        >
          <Trash2 size={13} />
          <span>{confirmReset ? 'Confirm Reset?' : 'Reset'}</span>
        </button>
      </div>
    </div>
  );
}
