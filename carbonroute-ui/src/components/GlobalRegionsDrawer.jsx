import React, { useState } from 'react';

export function GlobalRegionsDrawer({ regions }) {
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
          {regions.map(r => {
            const carbon = r.carbon_intensity;
            const carbonClass = carbon < 150 ? '' : carbon < 300 ? 'mid' : 'high';

            return (
              <div key={r.id} className="region-tile">
                <div className="tile-loc">{r.location}</div>
                <div className="tile-id">{r.id}</div>
                <div className="tile-meta tabular-numbers">
                  <span className={`tile-carbon ${carbonClass}`}>{carbon} g</span>
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
