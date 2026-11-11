import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

import { Header } from './components/Header';
import { GlobalRegionsDrawer } from './components/GlobalRegionsDrawer';
import { SLAControls } from './components/SLAControls';
import { AlertBanner } from './components/AlertBanner';
import { SkeletonLoader } from './components/SkeletonLoader';
import { TelemetryStats } from './components/TelemetryStats';
import { CandidatesTable } from './components/CandidatesTable';

export function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // SLA priorities & limits
  const [maxLatency, setMaxLatency] = useState(200);
  const [carbonWeight, setCarbonWeight] = useState(50);
  const [costWeight, setCostWeight] = useState(35);
  const [latencyWeight, setLatencyWeight] = useState(15);
  const [activePreset, setActivePreset] = useState('balanced');

  // Background gateway telemetry
  const [health, setHealth] = useState(null);
  const [globalRegions, setGlobalRegions] = useState([]);
  const [isPolling, setIsPolling] = useState(false);

  const abortControllerRef = useRef(null);

  // Derive API endpoint URL cleanly
  const API_BASE = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
    : import.meta.env.DEV
    ? 'http://localhost:3000'
    : 'https://carbonroute-ipqv.onrender.com';

  // Proactive background telemetry polling (every 15 seconds)
  const pollGateway = useCallback(async () => {
    setIsPolling(true);
    try {
      const [healthRes, regionsRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) }).catch(() => null),
        fetch(`${API_BASE}/api/v1/regions`, { signal: AbortSignal.timeout(6000) }).catch(() => null),
      ]);

      if (healthRes && healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
      } else {
        setHealth(null);
      }

      if (regionsRes && regionsRes.ok) {
        const rData = await regionsRes.json();
        if (Array.isArray(rData.regions)) {
          setGlobalRegions(rData.regions);
        }
      }
    } catch {
      setHealth(null);
    } finally {
      setIsPolling(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void pollGateway();
    const interval = setInterval(() => {
      void pollGateway();
    }, 15_000);
    return () => clearInterval(interval);
  }, [pollGateway]);

  // Handle in-flight request cancellation
  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  // Dispatch inference request
  const handleRouteRequest = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    // Cancel any previous in-flight request
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
          prompt: prompt.trim(),
          model: 'gemini-3.8-flash',
          sla: {
            max_latency_ms: maxLatency,
            carbon_priority_weight: carbonWeight / 100,
            cost_priority_weight: costWeight / 100,
            latency_priority_weight: latencyWeight / 100,
          },
        }),
      });

      const data = await response.json().catch(() => null);

      // True error detection checking status codes and response envelope
      if (!response.ok || data?.success === false || data?.status === 'error') {
        setError({
          code: data?.error?.code || data?.code || `HTTP_${response.status}`,
          message: data?.error?.message || data?.message || data?.error || response.statusText,
          details: data?.error?.details || data?.details || null,
          requestId: data?.meta?.request_id || data?.request_id || null,
        });
        setResult(null);
      } else {
        setResult(data);
        setError(null);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User voluntarily cancelled the request
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
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="app-wrapper">
      {/* Ambient Canvas Lighting */}
      <div className="ambient-glow" />
      <div className="ambient-grid" />

      <main className="main-viewport">
        {/* Header */}
        <Header health={health} isPolling={isPolling} />

        {/* Global Live Regions Drawer */}
        <GlobalRegionsDrawer regions={globalRegions} />

        {/* Workload Submission & SLA Config */}
        <div className="glass-panel input-card spring-enter">
          <form onSubmit={handleRouteRequest}>
            <div className="input-row">
              <input
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
                  <span style={{ fontSize: '12px' }}>➔</span>
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
            />
          </form>
        </div>

        {/* Alert Banner for SLA or API errors */}
        <AlertBanner error={error} />

        {/* Shimmer Skeleton during computation */}
        {loading && <SkeletonLoader />}

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="empty-hud spring-enter">
            <div className="empty-cmd-icon">⌘</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>System Idle</div>
            <div style={{ fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Awaiting generative AI workload. SLA dispatcher primed across global regions.
            </div>
          </div>
        )}

        {/* Results Presentation */}
        {result && !loading && (
          <>
            {/* Telemetry Hero Cards */}
            <TelemetryStats result={result} />

            {/* Inference Output Card */}
            <div className="glass-panel output-card spring-enter">
              <div className="output-header">
                <div className="stat-category" style={{ margin: 0 }}>
                  Inference Completion
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
                      {result.impact.estimated_emissions_avoided_g}g
                    </div>
                    <div className="impact-caption">
                      CO₂ Avoided vs. Baseline ({result.impact.baseline_location || result.impact.baseline_region})
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
                      {result.impact.estimated_emissions_g}g
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;
