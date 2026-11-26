import React, { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import './App.css';

import { Header } from './components/Header';
import { GlobalRegionsDrawer } from './components/GlobalRegionsDrawer';
import { SLAControls } from './components/SLAControls';
import { AlertBanner } from './components/AlertBanner';
import { SkeletonLoader } from './components/SkeletonLoader';
import { TelemetryStats } from './components/TelemetryStats';
import { CandidatesTable } from './components/CandidatesTable';
import { SessionLedgerBar } from './components/SessionLedgerBar';
import { CopyRequestIdBadge } from './components/CopyRequestIdBadge';
import { useSessionLedger } from './hooks/useSessionLedger';
import { computeLiveRegionProjection } from './utils/schedulerPreview';
import type {
  ApiErrorResponse,
  ClientErrorState,
  HealthResponse,
  InferenceSuccessResponse,
  RegionSnapshot,
  RegionsResponse,
  SLAPreset,
} from './types/contract';

const API_BASE: string = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:3000'
    : 'https://carbonroute-ipqv.onrender.com';

export function App() {
  const promptInputId = useId();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InferenceSuccessResponse | null>(null);
  const [error, setError] = useState<ClientErrorState | null>(null);

  // Model & SLA priorities (models populated dynamically from GET /api/v1/regions)
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [maxLatency, setMaxLatency] = useState(200);
  const [carbonWeight, setCarbonWeight] = useState(50);
  const [costWeight, setCostWeight] = useState(35);
  const [latencyWeight, setLatencyWeight] = useState(15);
  const [activePreset, setActivePreset] = useState<SLAPreset>('balanced');

  // Background gateway telemetry
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [globalRegions, setGlobalRegions] = useState<RegionSnapshot[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // Persistent Session Carbon Ledger
  const { ledger, recordRoutingEvent, resetLedger, exportTelemetryJson } = useSessionLedger();

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmittedPromptRef = useRef('');
  const hasUserSelectedModelRef = useRef(false);

  // Live client-side optimal region projection (exact 1:1 parity with backend scheduler)
  const projectedOptimalId = useMemo(() => {
    return computeLiveRegionProjection(globalRegions, {
      max_latency_ms: maxLatency,
      carbon_priority_weight: carbonWeight / 100,
      cost_priority_weight: costWeight / 100,
      latency_priority_weight: latencyWeight / 100,
    });
  }, [globalRegions, maxLatency, carbonWeight, costWeight, latencyWeight]);

  // Proactive background telemetry polling (every 15 seconds)
  const pollGateway = useCallback(async () => {
    setIsPolling(true);
    try {
      const [healthRes, regionsRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) }).catch(() => null),
        fetch(`${API_BASE}/api/v1/regions`, { signal: AbortSignal.timeout(6000) }).catch(() => null),
      ]);

      if (healthRes && healthRes.ok) {
        const hData = (await healthRes.json()) as HealthResponse;
        setHealth(hData);
      } else {
        setHealth(null);
      }

      if (regionsRes && regionsRes.ok) {
        const rData = (await regionsRes.json()) as RegionsResponse;
        if (Array.isArray(rData.regions)) {
          setGlobalRegions(rData.regions);
        }
        if (Array.isArray(rData.allowed_models) && rData.allowed_models.length > 0) {
          setAllowedModels(rData.allowed_models);
          setSelectedModel((prev) => {
            if (!hasUserSelectedModelRef.current || !prev) {
              return rData.allowed_models[0];
            }
            return rData.allowed_models.includes(prev) ? prev : rData.allowed_models[0];
          });
        }
      }
    } catch {
      setHealth(null);
    } finally {
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    void pollGateway();
    const interval = window.setInterval(() => {
      void pollGateway();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [pollGateway]);

  const handleModelChange = useCallback((model: string) => {
    hasUserSelectedModelRef.current = true;
    setSelectedModel(model);
  }, []);

  // Cancel active in-flight inference request
  const handleCancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  // Memoized inference dispatcher — decoupled from `prompt` input state to avoid re-renders on keystrokes
  const dispatchInference = useCallback(async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    lastSubmittedPromptRef.current = trimmed;

    // Cancel any previous in-flight request cleanly
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: trimmed,
          ...(selectedModel ? { model: selectedModel } : {}),
          sla: {
            max_latency_ms: maxLatency,
            carbon_priority_weight: carbonWeight / 100,
            cost_priority_weight: costWeight / 100,
            latency_priority_weight: latencyWeight / 100,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | InferenceSuccessResponse
        | ApiErrorResponse
        | null;

      if (!response.ok || !payload || !payload.success) {
        const errPayload = payload as ApiErrorResponse | null;
        setError({
          code: errPayload?.error?.code || errPayload?.code || `HTTP_${response.status}`,
          message:
            errPayload?.error?.message ||
            errPayload?.message ||
            response.statusText ||
            'Routing request failed.',
          details: errPayload?.error?.details || errPayload?.details || null,
          requestId: errPayload?.meta?.request_id || errPayload?.request_id || null,
        });
        setResult(null);
      } else {
        setResult(payload);
        setError(null);
        recordRoutingEvent(payload, trimmed);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return;
      }
      setError({
        code: 'network_offline',
        message: 'Could not connect to the CarbonRoute gateway. Verify backend status.',
        details: null,
        requestId: null,
      });
      setResult(null);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [selectedModel, maxLatency, carbonWeight, costWeight, latencyWeight, recordRoutingEvent]);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (loading) return;
      const targetPrompt = prompt.trim() || lastSubmittedPromptRef.current;
      if (targetPrompt) {
        void dispatchInference(targetPrompt);
      }
    },
    [prompt, loading, dispatchInference]
  );

  // Race-free retry directly invoking memoized dispatcher
  const handleRetry = useCallback(() => {
    if (loading) return;
    const targetPrompt = prompt.trim() || lastSubmittedPromptRef.current;
    if (targetPrompt) {
      if (!prompt.trim()) setPrompt(targetPrompt);
      void dispatchInference(targetPrompt);
    }
  }, [prompt, loading, dispatchInference]);

  return (
    <div className="app-wrapper">
      {/* Ambient Canvas Lighting */}
      <div className="ambient-glow" />
      <div className="ambient-grid" />

      <main className="main-viewport">
        {/* Header */}
        <Header health={health} isPolling={isPolling} />

        {/* Global Live Regions Drawer */}
        <GlobalRegionsDrawer
          regions={globalRegions}
          projectedOptimalId={projectedOptimalId}
          maxLatencyMs={maxLatency}
        />

        {/* Session Impact Ledger Summary Bar */}
        <SessionLedgerBar
          ledger={ledger}
          onExport={exportTelemetryJson}
          onReset={resetLedger}
        />

        {/* Workload Submission & SLA Config */}
        <div className="glass-panel input-card spring-enter">
          <form onSubmit={handleFormSubmit}>
            <div className="input-row">
              <label htmlFor={promptInputId} className="visually-hidden">
                Inference prompt
              </label>
              <input
                id={promptInputId}
                name="prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter prompt to compute via green cloud routing..."
                className="prompt-field"
                required
                disabled={loading}
              />
              {loading ? (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="btn-primary"
                >
                  <span>Route Prompt</span>
                  <span aria-hidden="true" style={{ fontSize: '12px' }}>➔</span>
                </button>
              )}
            </div>

            <SLAControls
              maxLatency={maxLatency}
              setMaxLatency={setMaxLatency}
              carbonWeight={carbonWeight}
              setCarbonWeight={setCarbonWeight}
              costWeight={costWeight}
              setCostWeight={setCostWeight}
              latencyWeight={latencyWeight}
              setLatencyWeight={setLatencyWeight}
              activePreset={activePreset}
              setActivePreset={setActivePreset}
              selectedModel={selectedModel}
              setSelectedModel={handleModelChange}
              allowedModels={allowedModels}
              disabled={loading}
            />
          </form>
        </div>

        {/* Alert Banner for SLA or API errors */}
        <AlertBanner
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />

        {/* Shimmer Skeleton during computation */}
        {loading && <SkeletonLoader />}

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="empty-hud spring-enter">
            <div className="empty-cmd-icon" aria-hidden="true">⌘</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>System Idle</div>
            <div style={{ fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Awaiting generative AI workload. SLA dispatcher primed across global regions.
            </div>
          </div>
        )}

        {/* Persistent Live Region announcing routed inference completions cleanly */}
        <section aria-live="polite" aria-label="Inference routing output">
          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Telemetry Hero Cards */}
              <TelemetryStats result={result} />

              {/* Inference Output Card */}
              <div className="glass-panel output-card spring-enter">
                <div className="output-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="stat-category" style={{ margin: 0 }}>
                      Inference Completion ({result.model})
                    </div>
                    <CopyRequestIdBadge requestId={result.meta?.request_id || result.request_id} />
                  </div>
                  {result.usage && (
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      Tokens: <span className="tabular-numbers">{result.usage.prompt_tokens || 0}</span> prompt /{' '}
                      <span className="tabular-numbers">{result.usage.output_tokens || 0}</span> output
                    </div>
                  )}
                </div>
                <div className="output-body">{result.data}</div>
              </div>

              {/* Environmental Impact Metrics */}
              {result.impact && (
                <div className="glass-panel impact-card spring-enter">
                  <div className="stat-category">Environmental Impact Summary</div>
                  <div className="impact-row">
                    <div className="impact-metric-block">
                      <div className="impact-number tabular-numbers">
                        {result.impact.estimated_emissions_avoided_g} gCO₂e
                      </div>
                      <div className="impact-caption">
                        CO₂e Avoided vs. Baseline ({result.impact.baseline_location || result.impact.baseline_region})
                      </div>
                    </div>

                    <div className="impact-metric-block">
                      <div className="impact-number tabular-numbers">
                        {result.impact.carbon_saved_pct}%
                      </div>
                      <div className="impact-caption">Grid Carbon Reduction</div>
                    </div>

                    <div className="impact-metric-block">
                      <div className="impact-number tabular-numbers" style={{ color: 'var(--text-primary)' }}>
                        {result.impact.estimated_emissions_g} gCO₂e
                      </div>
                      <div className="impact-caption">Total Generated Emissions</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Candidate Routing Comparison Matrix */}
              <CandidatesTable
                candidates={result.routing?.candidates}
                maxLatency={maxLatency}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
