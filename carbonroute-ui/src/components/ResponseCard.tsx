import { useEffect, useId, useRef, useState } from 'react';
import type { ApiErrorFieldDetail, ClientErrorState, InferenceSuccessResponse } from '../types/contract';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  X,
  Zap,
} from './Icons';
import { MarkdownRenderer } from './MarkdownRenderer';

const STARTER_PROMPTS = [
  'Explain Byzantine Fault Tolerance',
  'Compare Rust vs Go memory safety',
  'Design a sliding-window rate limiter in Redis',
  'Summarize how green grid carbon intensity works',
] as const;

export interface ResponseCardProps {
  result: InferenceSuccessResponse | null;
  loading: boolean;
  error: ClientErrorState | null;
  projectedOptimalId: string | null;
  maxLatency: number;
  onSelectStarterPrompt: (prompt: string) => void;
  onRetry: () => void;
  onDismissError: () => void;
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
    return 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway attempted failover — please retry.';
  }
  const parsed = tryExtractEmbeddedJson(str);
  if (parsed) {
    const nestedError = parsed.error as Record<string, unknown> | undefined;
    if (nestedError && typeof nestedError.message === 'string') return nestedError.message;
    if (typeof parsed.message === 'string') return parsed.message;
  }
  return str;
}

function ActionCopyButton({
  value,
  label,
  copiedLabel,
  ariaLabel,
  className = 'btn-ghost-action',
}: {
  value: string;
  label: string;
  copiedLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setStatus('idle');
      timerRef.current = null;
    }, 2000);
  };

  return (
    <span className="copy-control-wrap">
      <button
        type="button"
        onClick={handleCopy}
        className={className}
        title={ariaLabel}
      >
        {status === 'copied' ? <Check size={13} className="accent-mint" /> : <Copy size={13} />}
        <span>{status === 'copied' ? copiedLabel : status === 'failed' ? 'Failed' : label}</span>
      </button>
      <span className="visually-hidden" role="status">
        {status === 'copied' ? `${copiedLabel}` : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </span>
  );
}

export function ResponseCard({
  result,
  loading,
  error,
  projectedOptimalId,
  maxLatency,
  onSelectStarterPrompt,
  onRetry,
  onDismissError,
}: ResponseCardProps) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const matrixId = useId();

  const detailsList: ApiErrorFieldDetail[] = Array.isArray(error?.details) ? error.details : [];
  const isSlaError = error?.code === 'sla_unsatisfiable';
  const traceId = result?.meta?.request_id || result?.request_id || '';
  const candidates = result?.routing?.candidates ?? [];
  const isCache = Boolean(result?.cache_hit);

  return (
    <section className="response-area" aria-label="Inference routing response">
      {/* Error State */}
      {error && !loading && (
        <div className="error-panel" role="alert" aria-live="assertive">
          <div className="error-header">
            <div className="error-title-group">
              <AlertTriangle size={16} className="accent-coral" />
              <span className="error-code mono-tabular">
                {isSlaError ? 'SLA_UNSATISFIABLE' : error.code || 'ROUTING_ERROR'}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onDismissError}
              aria-label="Dismiss error alert"
            >
              <X size={14} />
            </button>
          </div>

          <p className="error-message">{sanitizeErrorMessage(error.message)}</p>

          {detailsList.length > 0 && (
            <ul className="error-details-list">
              {detailsList.map((d, idx) => (
                <li key={`${d.field}-${idx}`}>
                  <strong className="mono-tabular">{d.field}</strong>: {d.message}
                </li>
              ))}
            </ul>
          )}

          {isSlaError && (
            <p className="error-hint">
              Increase Latency SLA above 175 ms to admit low-carbon global data centers.
            </p>
          )}

          <div className="error-footer">
            {error.requestId ? (
              <div className="error-trace-group">
                <span className="mono-tabular text-muted">Trace ID: {error.requestId}</span>
                <ActionCopyButton
                  value={error.requestId}
                  label="Copy ID"
                  copiedLabel="Copied"
                  ariaLabel={`Copy trace ID ${error.requestId}`}
                />
              </div>
            ) : (
              <div />
            )}

            <button type="button" onClick={onRetry} className="btn-secondary">
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          className="surface-card response-skeleton"
          role="progressbar"
          aria-busy="true"
          aria-label="Routing inference workload"
        >
          <div className="loading-status-line">
            <Activity size={14} className="accent-mint" />
            <span>
              Routing via projected optimal node:{' '}
              <strong className="mono-tabular text-primary">
                {projectedOptimalId ?? 'evaluating grid telemetry'}
              </strong>
            </span>
          </div>
          <div className="skeleton-stack">
            <div className="skeleton-line" style={{ width: '38%', height: '14px' }} />
            <div className="skeleton-line" style={{ width: '94%', height: '13px' }} />
            <div className="skeleton-line" style={{ width: '88%', height: '13px' }} />
            <div className="skeleton-line" style={{ width: '68%', height: '13px' }} />
          </div>
        </div>
      )}

      {/* Empty Editorial Starter State */}
      {!result && !loading && !error && (
        <div className="starter-panel">
          <div className="starter-header">
            <h2 className="starter-title">Ready to Route</h2>
            <p className="starter-subtitle">
              Submit a prompt above or launch a starter workload below. The scheduler dynamically minimizes carbon emissions, token cost, and latency within your SLA bound.
            </p>
          </div>
          <div className="starter-chips-grid">
            {STARTER_PROMPTS.map((starter) => (
              <button
                key={starter}
                type="button"
                className="starter-chip"
                onClick={() => onSelectStarterPrompt(starter)}
              >
                <span>{starter}</span>
                <ArrowRight size={13} className="starter-chip-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persistent Live Region for Inference Output */}
      <div aria-live="polite">
        {result && !loading && (
          <div className="surface-card response-card">
            {/* Top Route Trace Breadcrumb */}
            <div className="route-breadcrumb-bar">
              <div className="breadcrumb-flow">
                <span className="breadcrumb-step">Prompt</span>
                <ArrowRight size={12} className="text-muted" />
                {isCache ? (
                  <span className="breadcrumb-target accent-sky mono-tabular">
                    <Zap size={13} />
                    <span>Edge Cache · 0.000 gCO₂e</span>
                  </span>
                ) : (
                  <span className="breadcrumb-target mono-tabular">
                    <Activity size={13} className="accent-mint" />
                    <span>
                      {result.routed_to} ({result.location}) · {result.telemetry.carbon_intensity} gCO₂e/kWh
                    </span>
                  </span>
                )}
              </div>

              <div className="breadcrumb-badges">
                {result.impact && (
                  <span className="savings-pill mono-tabular">
                    -{result.impact.carbon_saved_pct}% vs.{' '}
                    {result.impact.baseline_location || result.impact.baseline_region}
                  </span>
                )}
                <span className="model-badge mono-tabular">{result.model}</span>
              </div>
            </div>

            {/* Editorial Markdown Prose */}
            <div className="response-prose-wrap">
              <MarkdownRenderer content={result.data} />
            </div>

            {/* Bottom Apple Activity Telemetry Bento Strip & Capsule Actions */}
            <div className="response-footer">
              <div className="telemetry-strip">
                <div className="telemetry-stat">
                  <span className="telemetry-stat-label">Latency</span>
                  <span className="telemetry-stat-val mono-tabular">
                    {result.telemetry.latency_ms.toLocaleString()} ms
                  </span>
                </div>

                <div className="telemetry-stat">
                  <span className="telemetry-stat-label">Emissions</span>
                  <span className="telemetry-stat-val mono-tabular">
                    {result.impact ? `${result.impact.estimated_emissions_g} gCO₂e` : '—'}
                  </span>
                </div>

                <div className="telemetry-stat">
                  <span className="telemetry-stat-label">Avoided</span>
                  <span
                    className={`telemetry-stat-val mono-tabular${
                      result.impact ? ' accent-mint' : ''
                    }`}
                  >
                    {result.impact ? `${result.impact.estimated_emissions_avoided_g} gCO₂e` : '—'}
                  </span>
                </div>

                <div className="telemetry-stat">
                  <span className="telemetry-stat-label">Tokens</span>
                  <span className="telemetry-stat-val mono-tabular">
                    {result.usage
                      ? `${(result.usage.prompt_tokens ?? 0).toLocaleString()} in / ${(
                          result.usage.output_tokens ?? 0
                        ).toLocaleString()} out`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="footer-actions">
                <ActionCopyButton
                  value={result.data}
                  label="Copy Output"
                  copiedLabel="Copied"
                  ariaLabel="Copy inference response text"
                />
                {traceId && (
                  <ActionCopyButton
                    value={traceId}
                    label={`Trace ${traceId.slice(0, 8)}`}
                    copiedLabel="Trace Copied"
                    ariaLabel={`Copy request trace ID ${traceId}`}
                  />
                )}
              </div>
            </div>

            {/* Collapsible Evaluated Candidates Matrix */}
            {candidates.length > 0 && (
              <div className="candidates-disclosure">
                <button
                  type="button"
                  className="disclosure-trigger"
                  aria-expanded={matrixOpen}
                  aria-controls={matrixId}
                  onClick={() => setMatrixOpen((prev) => !prev)}
                >
                  <span>
                    Evaluated Candidates Matrix{' '}
                    <span className="mono-tabular text-muted">({candidates.length})</span>
                  </span>
                  {matrixOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {matrixOpen && (
                  <div id={matrixId} className="matrix-scroll">
                    <table className="candidates-matrix">
                      <caption className="visually-hidden">
                        Evaluated cloud regions ranked by multi-objective optimization score
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Region</th>
                          <th scope="col">Latency</th>
                          <th scope="col">Carbon</th>
                          <th scope="col">Cost / 1k</th>
                          <th scope="col">Score</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => {
                          const isSelected = c.status === 'selected';
                          const isExcluded = c.status === 'excluded' || c.latency_ms > maxLatency;
                          const carbonTone =
                            c.carbon_intensity < 100
                              ? 'accent-mint'
                              : c.carbon_intensity <= 300
                                ? 'accent-amber'
                                : 'accent-coral';

                          return (
                            <tr key={c.id} className={isSelected ? 'row-selected' : ''}>
                              <th scope="row" className="matrix-region-cell">
                                <span className="matrix-loc">{c.location}</span>
                                <span className="matrix-id mono-tabular">{c.id}</span>
                              </th>
                              <td className={`mono-tabular ${c.latency_ms > maxLatency ? 'accent-coral' : ''}`}>
                                {c.latency_ms} ms
                              </td>
                              <td className={`mono-tabular ${carbonTone}`}>
                                {c.carbon_intensity} gCO₂e/kWh
                              </td>
                              <td className="mono-tabular">
                                ${c.cost_per_1k_tokens.toFixed(4)}
                              </td>
                              <td className="mono-tabular">
                                {typeof c.score === 'number' ? c.score.toFixed(4) : '--'}
                              </td>
                              <td>
                                {isSelected ? (
                                  <span className="status-tag tag-selected">Selected</span>
                                ) : isExcluded ? (
                                  <span className="status-tag tag-breach" title={c.excluded_reason || 'SLA breached'}>
                                    SLA Breach
                                  </span>
                                ) : (
                                  <span className="status-tag tag-eligible mono-tabular">
                                    Rank #{c.rank}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
