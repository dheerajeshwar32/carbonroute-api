import { useCallback, useId, useRef, useState } from 'react';
import type { HealthResponse, SessionLedgerSummary } from '../types/contract';
import { ChevronDown, Leaf, LogoMark } from './Icons';
import { SessionPopover } from './SessionPopover';

export interface TopBarProps {
  health: HealthResponse | null;
  hasPolledOnce: boolean;
  isPolling: boolean;
  ledger: SessionLedgerSummary;
  onExportLedger: () => void;
  onResetLedger: () => void;
}

export function TopBar({
  health,
  hasPolledOnce,
  isPolling,
  ledger,
  onExportLedger,
  onResetLedger,
}: TopBarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();

  const handleClose = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  const isOffline = hasPolledOnce && health === null;
  const isHealthy = health?.status === 'ok' || health?.success === true;
  const isLiveTelemetry =
    health?.execution_mode === 'regional' ||
    health?.telemetry?.provider === 'electricity_maps';

  let dotClass = 'status-dot-idle';
  let statusText = 'Connecting';
  if (isOffline) {
    dotClass = 'status-dot-offline';
    statusText = 'Gateway Active · Offline';
  } else if (isHealthy) {
    dotClass = 'status-dot-live';
    statusText = isLiveTelemetry ? 'Gateway Active · Live' : 'Gateway Active · Simulated';
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <LogoMark size={22} />
          <h1 className="brand-wordmark">CarbonRoute</h1>
        </div>

        <div className="topbar-actions">
          <div className="health-pill" title={isPolling ? 'Refreshing telemetry' : 'Gateway health status'}>
            <span className={`status-dot ${dotClass}`} aria-hidden="true" />
            <span className="health-label">{statusText}</span>
          </div>

          <div className="session-anchor">
            <button
              ref={triggerRef}
              type="button"
              className={`session-pill ${popoverOpen ? 'active' : ''}`}
              aria-expanded={popoverOpen}
              aria-controls={popoverId}
              aria-label="Toggle session carbon impact ledger"
              onClick={() => setPopoverOpen((prev) => !prev)}
            >
              <Leaf size={13} className="accent-mint" />
              <span className="mono-tabular">
                {ledger.totalRequests} runs · {ledger.cumulativeEmissionsSavedG.toFixed(3)} gCO₂e saved ·{' '}
                {ledger.cacheHitRatio}% cache
              </span>
              <ChevronDown size={13} className={popoverOpen ? 'chevron-rotated' : ''} />
            </button>

            <SessionPopover
              id={popoverId}
              isOpen={popoverOpen}
              onClose={handleClose}
              anchorRef={triggerRef}
              ledger={ledger}
              onExport={onExportLedger}
              onReset={onResetLedger}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
