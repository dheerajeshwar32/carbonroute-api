import React, { useEffect, useState } from 'react';

export function TelemetryStats({ result }) {
  if (!result || !result.telemetry) return null;

  const isCache = Boolean(result.cache_hit);
  const carbonValue = result.telemetry.live_carbon_intensity ?? result.telemetry.carbon_intensity ?? 0;
  const latencyMs = result.telemetry.latency_ms ?? 0;

  // Dynamic maximum calculation across all candidate regions, defaulting to at least 700
  const candidateCarbons = result.routing?.candidates?.map(c => c.carbon_intensity) || [];
  const maxScale = Math.max(700, ...candidateCarbons);
  const targetPct = isCache ? 0 : Math.min(100, Math.round((carbonValue / maxScale) * 100));

  const [gaugeWidth, setGaugeWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGaugeWidth(targetPct);
    }, 60);
    return () => clearTimeout(timer);
  }, [targetPct]);

  // Color selection
  const carbonColor = isCache
    ? 'var(--accent-green)'
    : carbonValue < 150
    ? 'var(--accent-green)'
    : carbonValue < 300
    ? 'var(--accent-amber)'
    : 'var(--accent-red)';

  return (
    <div className="telemetry-grid spring-enter">
      {/* 1. Routed Edge Node */}
      <div className="glass-panel stat-tile">
        <div className="stat-category">Routed Edge Node</div>
        <div className="stat-metric-hero" style={{ fontSize: '24px' }}>
          {result.location || 'Unknown Region'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {result.routed_to}
          </span>
          {isCache && <span className="cache-badge">⚡ Redis Cache (0g)</span>}
        </div>
      </div>

      {/* 2. Grid Carbon Intensity */}
      <div className="glass-panel stat-tile">
        <div className="stat-category">Grid Carbon Intensity</div>
        <div className="stat-metric-hero tabular-numbers" style={{ color: carbonColor }}>
          {carbonValue}{' '}
          <span className="stat-unit-label">gCO₂e/kWh</span>
        </div>
        <div className="gauge-track">
          <div
            className="gauge-progress"
            style={{
              width: `${gaugeWidth}%`,
              background: carbonColor,
              boxShadow: `0 0 12px ${carbonColor}40`,
            }}
          />
        </div>
        <div className="stat-subtext-detail" style={{ color: carbonColor }}>
          {isCache
            ? 'Zero-emission execution (Cache Hit)'
            : carbonValue < 150
            ? 'Surplus renewable grid generation'
            : carbonValue < 300
            ? 'Moderate grid emissions'
            : 'Fossil-heavy peak grid draw'}
        </div>
      </div>

      {/* 3. Latency Metric */}
      <div className="glass-panel stat-tile">
        <div className="stat-category">Roundtrip Latency</div>
        <div className="stat-metric-hero tabular-numbers">
          {latencyMs}{' '}
          <span className="stat-unit-label">ms</span>
        </div>
        <div className="stat-subtext-detail" style={{ marginTop: '28px' }}>
          {isCache ? 'Local edge proxy response' : `${result.telemetry.latency_source || 'measured'} cloud dispatch`}
        </div>
      </div>
    </div>
  );
}
