import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { TopBar } from './components/TopBar';
import { PromptComposer } from './components/PromptComposer';
import { ResponseCard } from './components/ResponseCard';
import { TelemetryRail } from './components/TelemetryRail';
import { SlaControls } from './components/SlaControls';
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
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InferenceSuccessResponse | null>(null);
  const [error, setError] = useState<ClientErrorState | null>(null);

  // Model & SLA priorities (models populated strictly from GET /api/v1/regions)
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [maxLatency, setMaxLatency] = useState(200);
  const [carbonWeight, setCarbonWeight] = useState(50);
  const [costWeight, setCostWeight] = useState(35);
  const [latencyWeight, setLatencyWeight] = useState(15);
  const [activePreset, setActivePreset] = useState<SLAPreset>('balanced');
  const [routedPreset, setRoutedPreset] = useState<SLAPreset>('balanced');

  // Background gateway telemetry
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [hasPolledOnce, setHasPolledOnce] = useState(false);
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
          const preferredDefault =
            rData.default_model && rData.allowed_models.includes(rData.default_model)
              ? rData.default_model
              : rData.allowed_models[0];
          setSelectedModel((prev) => {
            if (!hasUserSelectedModelRef.current || !prev) {
              return preferredDefault;
            }
            return rData.allowed_models.includes(prev) ? prev : preferredDefault;
          });
        }
      }
    } catch {
      setHealth(null);
    } finally {
      setHasPolledOnce(true);
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

  const handleCancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  // Memoized inference dispatcher — decoupled from `prompt` input state
  const dispatchInference = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;

      lastSubmittedPromptRef.current = trimmed;

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
          setRoutedPreset(activePreset);
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
    },
    [
      selectedModel,
      maxLatency,
      carbonWeight,
      costWeight,
      latencyWeight,
      activePreset,
      recordRoutingEvent,
    ]
  );

  const handleSelectStarterPrompt = useCallback(
    (starterPrompt: string) => {
      if (loading) return;
      setPrompt(starterPrompt);
      void dispatchInference(starterPrompt);
    },
    [loading, dispatchInference]
  );

  const handleRetry = useCallback(() => {
    if (loading) return;
    const targetPrompt = prompt.trim() || lastSubmittedPromptRef.current;
    if (targetPrompt) {
      if (!prompt.trim()) setPrompt(targetPrompt);
      void dispatchInference(targetPrompt);
    }
  }, [prompt, loading, dispatchInference]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="app-shell">
      <TopBar
        health={health}
        hasPolledOnce={hasPolledOnce}
        isPolling={isPolling}
        ledger={ledger}
        onExportLedger={exportTelemetryJson}
        onResetLedger={resetLedger}
      />

      <main className="workbench-container">
        <div className="workbench-grid">
          {/* Primary Command & Editorial Response Column */}
          <div className="workbench-primary">
            <PromptComposer
              prompt={prompt}
              setPrompt={setPrompt}
              allowedModels={allowedModels}
              selectedModel={selectedModel}
              onSelectModel={handleModelChange}
              loading={loading}
              onSubmitPrompt={dispatchInference}
              onCancel={handleCancelRequest}
            />

            <ResponseCard
              result={result}
              loading={loading}
              error={error}
              projectedOptimalId={projectedOptimalId}
              maxLatency={maxLatency}
              carbonWeight={carbonWeight}
              costWeight={costWeight}
              latencyWeight={latencyWeight}
              activePreset={routedPreset}
              onSelectStarterPrompt={handleSelectStarterPrompt}
              onRetry={handleRetry}
              onDismissError={handleDismissError}
            />
          </div>

          {/* Right Telemetry & Precision SLA Control Rail */}
          <aside className="workbench-rail" aria-label="Telemetry and SLA controls">
            <TelemetryRail
              regions={globalRegions}
              maxLatency={maxLatency}
              carbonWeight={carbonWeight}
              costWeight={costWeight}
              latencyWeight={latencyWeight}
            />

            <SlaControls
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
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
