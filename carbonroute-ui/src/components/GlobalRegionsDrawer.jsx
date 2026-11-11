import React, { useState } from 'react';

export function GlobalRegionsDrawer({ regions, projectedOptimalId, maxLatencyMs }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!regions || regions.length === 0) {
    return null;
  }

  return (
    <div className="glass-panel regions-drawer spring-enter">
      <div className="drawer-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="drawer-title">
          <span>Global Compute Telemetry</span>
          <span className="drawer-count-badge">{regions.length} Active Regions</span>
        </div>
        <button
          type="button"
          className="drawer-toggle-btn"
          aria-label={isOpen ? 'Collapse drawer' : 'Expand drawer'}
        >
          {isOpen ? 'Hide Grid ▲' : 'Show Grid ▼'}
        </button>
      </div>

      {isOpen && (
        <div className="regions-grid">
          {regions.map((r) => {
            const carbon = r.carbon_intensity;
            const carbonClass = carbon < 150 ? '' : carbon < 300 ? 'mid' : 'high';
            const isOptimal = r.id === projectedOptimalId;
            const isExceeded = Boolean(maxLatencyMs && r.latency_ms > maxLatencyMs);

            const tileClasses = [
              'region-tile',
              isOptimal ? 'is-optimal' : '',
              isExceeded ? 'is-sla-exceeded' : '',
            ].filter(Boolean).join(' ');

            return (
              <div key={r.id} className={tileClasses}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="tile-loc">{r.location}</div>
                  {isOptimal && <span className="badge-optimal">★ OPTIMAL</span>}
                  {isExceeded && !isOptimal && <span className="badge-exceeded">SLA EXCEEDED</span>}
                </div>
                <div className="tile-id">{r.id}</div>
                <div className="tile-meta tabular-numbers">
                  <span className={`tile-carbon ${carbonClass}`}>
                    {carbon} <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 400 }}>gCO₂/kWh</span>
                  </span>
                  <span className="tile-lat">{r.latency_ms} ms</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
