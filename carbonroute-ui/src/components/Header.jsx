import React from 'react';
import { LogoMark } from './LogoMark';

export function Header({ health, isPolling }) {
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

      <div className="status-pill">
        <span
          className={`status-dot ${isOffline ? 'offline' : isHealthy ? '' : 'degraded'}`}
          title={isOffline ? 'Gateway unreachable' : `Gateway running (${health?.execution_mode || 'online'})`}
        />
        <span>
          {isOffline
            ? 'gateway offline'
            : isHealthy
            ? `gateway active • ${health?.execution_mode || 'simulated'}`
            : 'connecting...'}
        </span>
        {isPolling && <span style={{ opacity: 0.5, fontSize: '10px' }}>↻</span>}
      </div>
    </header>
  );
}
