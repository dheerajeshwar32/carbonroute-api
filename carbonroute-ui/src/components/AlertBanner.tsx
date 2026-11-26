import type { ApiErrorFieldDetail, ClientErrorState } from '../types/contract';

export interface AlertBannerProps {
  error: ClientErrorState | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

function tryExtractEmbeddedJson(str: string): Record<string, unknown> | null {
  for (let scanStart = 0; scanStart < str.length; scanStart++) {
    if (str[scanStart] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIdx = -1;

    for (let i = scanStart; i < str.length; i++) {
      const ch = str[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) continue;
    try {
      const parsed = JSON.parse(str.slice(scanStart, endIdx + 1)) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function sanitizeErrorMessage(msg: string | undefined): string {
  if (!msg) return 'An unexpected routing failure occurred.';
  const str = String(msg);
  if (str.includes('504') || str.includes('DEADLINE_EXCEEDED') || /deadline expired/i.test(str)) {
    return 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
  }

  const parsed = tryExtractEmbeddedJson(str);
  if (parsed) {
    const nestedError = parsed.error as Record<string, unknown> | undefined;
    if (nestedError && typeof nestedError.message === 'string') return nestedError.message;
    if (typeof parsed.message === 'string') return parsed.message;
  }
  return str;
}

export function AlertBanner({ error, onDismiss, onRetry }: AlertBannerProps) {
  if (!error) return null;

  const isSlaError = error.code === 'sla_unsatisfiable';
  const detailsList: ApiErrorFieldDetail[] = Array.isArray(error.details) ? error.details : [];
  const cleanMessage = sanitizeErrorMessage(error.message);

  return (
    <div
      className="glass-panel alert-card spring-enter"
      role="alert"
      aria-live="assertive"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="alert-header">
          <span aria-hidden="true" style={{ fontSize: '16px' }}>⚠️</span>
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
            aria-label="Dismiss error alert"
            title="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>

      <div className="alert-msg">{cleanMessage}</div>

      {detailsList.length > 0 && (
        <ul style={{ marginTop: '8px', paddingLeft: '18px', fontSize: '13px', color: '#FDA4AF' }}>
          {detailsList.map((d, i) => (
            <li key={`${d.field}-${i}`}>
              <strong>{d.field}</strong>: {d.message}
            </li>
          ))}
        </ul>
      )}

      {isSlaError && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#FCD34D' }}>
          <span aria-hidden="true">💡</span>{' '}
          <em>Tip: Try increasing the Max Latency limit slider above 175ms to admit global low-carbon regions.</em>
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
