import React from 'react';

function sanitizeErrorMessage(msg) {
  if (!msg) return 'An unexpected routing failure occurred.';
  const str = String(msg);
  if (str.includes('504') || str.includes('DEADLINE_EXCEEDED') || /deadline expired/i.test(str)) {
    return 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
  }
  const jsonMatch = str.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {
      // Fall through to str
    }
  }
  return str;
}

export function AlertBanner({ error, onDismiss, onRetry }) {
  if (!error) return null;

  const isSlaError = error.code === 'sla_unsatisfiable';
  const hasDetails = Array.isArray(error.details) && error.details.length > 0;
  const cleanMessage = sanitizeErrorMessage(error.message);

  return (
    <div className="glass-panel alert-card spring-enter" role="alert">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="alert-header">
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span className="alert-title">
            {isSlaError ? 'SLA Constraint Unsatisfiable' : error.code || 'Routing Exception'}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
            }}
            title="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>

      <div className="alert-msg">{cleanMessage}</div>

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
        {error.requestId ? (
          <div className="alert-trace tabular-numbers">
            Trace ID: <code>{error.requestId}</code>
          </div>
        ) : <div />}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-alert-retry"
            title="Retry the inference request"
          >
            <span>↻ Retry Request</span>
          </button>
        )}
      </div>
    </div>
  );
}
