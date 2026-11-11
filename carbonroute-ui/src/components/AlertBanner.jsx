import React from 'react';

export function AlertBanner({ error, onDismiss }) {
  if (!error) return null;

  const isSlaError = error.code === 'sla_unsatisfiable';
  const hasDetails = Array.isArray(error.details) && error.details.length > 0;

  return (
    <div className="glass-panel alert-card spring-enter" role="alert">
      <div className="alert-header">
        <span style={{ fontSize: '16px' }}>⚠️</span>
        <span className="alert-title">
          {isSlaError ? 'SLA Constraint Unsatisfiable' : error.code || 'Routing Exception'}
        </span>
      </div>

      <div className="alert-msg">{error.message || 'An unexpected routing failure occurred.'}</div>

      {hasDetails && (
        <ul style={{ marginTop: '8px', paddingLeft: '18px', fontSize: '13px', color: '#FDA4AF' }}>
          {error.details.map((d, i) => (
            <li key={i}>
              <strong>{d.field}</strong>: {d.message}
            </li>
          ))}
        </ul>
      )}

      {isSlaError && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#FCD34D' }}>
          💡 <em>Tip: Try increasing the Max Latency limit slider above 175ms to admit global low-carbon regions.</em>
        </div>
      )}

      {error.requestId && (
        <div className="alert-trace tabular-numbers">
          Trace ID: <code>{error.requestId}</code>
        </div>
      )}
    </div>
  );
}
