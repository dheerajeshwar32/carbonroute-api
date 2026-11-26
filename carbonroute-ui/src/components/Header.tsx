import { LogoMark } from './LogoMark';
import type { HealthResponse } from '../types/contract';

export interface HeaderProps {
  health: HealthResponse | null;
  isPolling: boolean;
}

export function Header({ health, isPolling }: HeaderProps) {
  const isHealthy = health?.status === 'ok' || health?.success === true;
  const isOffline = health === null;

  return (
    <header className="app-header spring-enter">
      <div className="header-left">
        <LogoMark size={46} />
        <div>
          <h1 className="brand-text">
            <span className="brand-carbon">Carbon</span>
            <span className="brand-route">Route</span>
          </h1>
          <div className="brand-subtitle">sustainable inference routing</div>
        </div>
      </div>

      <div className="status-pill" aria-label="Gateway connectivity status">
        <span
          className={`status-dot ${isOffline ? 'offline' : isHealthy ? '' : 'degraded'}`}
          aria-hidden="true"
          title={isOffline ? 'Gateway unreachable' : `Gateway running (${health?.execution_mode || 'online'})`}
        />
        <span>
          {isOffline
            ? 'gateway offline'
            : isHealthy
            ? `gateway active • ${health?.execution_mode || 'simulated'}`
            : 'connecting...'}
        </span>
        {isPolling && (
          <span aria-hidden="true" style={{ opacity: 0.5, fontSize: '10px' }}>
            ↻
          </span>
        )}
      </div>
    </header>
  );
}
