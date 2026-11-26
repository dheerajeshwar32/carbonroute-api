import { useState, useEffect, useCallback } from 'react';
import type {
  CandidateEvaluation,
  InferenceSuccessResponse,
  SessionLedgerItem,
  SessionLedgerSummary,
  TelemetryExportPayload,
} from '../types/contract';

export const SESSION_LEDGER_STORAGE_KEY = 'carbonroute_session_ledger_v1';
const DEFAULT_ENERGY_WH = 0.24; // Google Gemini text median energy per prompt (Aug 2025)

const round = (num: number | undefined | null, digits = 4): number =>
  Number(Number(num || 0).toFixed(digits));

export const INITIAL_LEDGER_STATE: SessionLedgerSummary = {
  totalRequests: 0,
  cacheHits: 0,
  cacheHitRatio: 0,
  cumulativeEmissionsSavedG: 0,
  cumulativeEmissionsGeneratedG: 0,
  history: [],
};

export function loadLedgerFromStorage(): SessionLedgerSummary {
  try {
    const stored = localStorage.getItem(SESSION_LEDGER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SessionLedgerSummary>;
      if (typeof parsed?.totalRequests === 'number' && Array.isArray(parsed?.history)) {
        return {
          totalRequests: parsed.totalRequests,
          cacheHits: typeof parsed.cacheHits === 'number' ? parsed.cacheHits : 0,
          cacheHitRatio: typeof parsed.cacheHitRatio === 'number' ? parsed.cacheHitRatio : 0,
          cumulativeEmissionsSavedG: typeof parsed.cumulativeEmissionsSavedG === 'number' ? parsed.cumulativeEmissionsSavedG : 0,
          cumulativeEmissionsGeneratedG: typeof parsed.cumulativeEmissionsGeneratedG === 'number' ? parsed.cumulativeEmissionsGeneratedG : 0,
          history: parsed.history,
        };
      }
    }
  } catch {
    // Fallback on corrupt or inaccessible storage
  }
  return INITIAL_LEDGER_STATE;
}

export function applyRoutingEventToLedger(
  prev: SessionLedgerSummary,
  result: InferenceSuccessResponse,
  prompt: string
): SessionLedgerSummary {
  if (!result || !result.telemetry) return prev;

  const isCache = Boolean(result.cache_hit);
  const candidates: CandidateEvaluation[] = result.routing?.candidates ?? [];
  const energyWh = result.impact?.energy_per_request_wh ?? DEFAULT_ENERGY_WH;

  // Find highest-carbon candidate evaluated in this routing decision
  const fallbackDirtiest = {
    carbon_intensity: result.impact?.baseline_carbon_intensity ?? 500,
    location: result.impact?.baseline_location ?? 'Standard Coal Grid',
    id: result.impact?.baseline_region ?? 'dirty-baseline',
  };

  const highestCarbonCandidate = candidates.length > 0
    ? candidates.reduce<CandidateEvaluation | typeof fallbackDirtiest>(
        (max, curr) => (curr.carbon_intensity > max.carbon_intensity ? curr : max),
        candidates[0]
      )
    : fallbackDirtiest;

  const dirtiestCarbon = highestCarbonCandidate.carbon_intensity || 500;
  const worstCaseEmissionsG = (energyWh * dirtiestCarbon) / 1000;

  const actualEmissionsG = isCache
    ? 0
    : (result.impact?.estimated_emissions_g ??
       (energyWh * (result.telemetry.carbon_intensity || result.telemetry.live_carbon_intensity || 0)) / 1000);

  const emissionsSavedG = Math.max(0, worstCaseEmissionsG - actualEmissionsG);

  const newTotal = prev.totalRequests + 1;
  const newCacheHits = prev.cacheHits + (isCache ? 1 : 0);
  const newRatio = round((newCacheHits / newTotal) * 100, 1);
  const newSaved = round(prev.cumulativeEmissionsSavedG + emissionsSavedG, 4);
  const newGen = round(prev.cumulativeEmissionsGeneratedG + actualEmissionsG, 4);

  const newItem: SessionLedgerItem = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `item-${Date.now()}`,
    timestamp: new Date().toISOString(),
    prompt: prompt.slice(0, 100),
    model: result.model || 'unknown',
    routedTo: result.routed_to || 'cache',
    location: result.location || 'Local Edge',
    cacheHit: isCache,
    latencyMs: result.telemetry.latency_ms || 0,
    carbonIntensity: result.telemetry.carbon_intensity || 0,
    emissionsSavedG: round(emissionsSavedG, 5),
    emissionsGeneratedG: round(actualEmissionsG, 5),
    dirtiestRegion: `${highestCarbonCandidate.location} (${highestCarbonCandidate.id})`,
    dirtiestCarbon,
    requestId: result.meta?.request_id || result.request_id || 'unknown',
  };

  return {
    totalRequests: newTotal,
    cacheHits: newCacheHits,
    cacheHitRatio: newRatio,
    cumulativeEmissionsSavedG: newSaved,
    cumulativeEmissionsGeneratedG: newGen,
    history: [newItem, ...prev.history].slice(0, 50),
  };
}

export function buildTelemetryExportPayload(ledger: SessionLedgerSummary): TelemetryExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    clientApp: 'CarbonRoute Web Dashboard',
    version: '1.0.0',
    summary: {
      totalRequests: ledger.totalRequests,
      cacheHits: ledger.cacheHits,
      cacheHitRatioPct: ledger.cacheHitRatio,
      cumulativeEmissionsSavedG: ledger.cumulativeEmissionsSavedG,
      cumulativeEmissionsGeneratedG: ledger.cumulativeEmissionsGeneratedG,
    },
    ledger: ledger.history,
  };
}

export function useSessionLedger() {
  const [ledger, setLedger] = useState<SessionLedgerSummary>(loadLedgerFromStorage);

  // Sync non-empty state changes to localStorage; clear key when empty/reset
  useEffect(() => {
    try {
      if (ledger.totalRequests === 0 && ledger.history.length === 0) {
        localStorage.removeItem(SESSION_LEDGER_STORAGE_KEY);
      } else {
        localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
      }
    } catch (e) {
      console.warn('Failed to save session ledger to localStorage', e);
    }
  }, [ledger]);

  const recordRoutingEvent = useCallback((result: InferenceSuccessResponse, prompt: string) => {
    setLedger((prev) => applyRoutingEventToLedger(prev, result, prompt));
  }, []);

  const resetLedger = useCallback(() => {
    setLedger(INITIAL_LEDGER_STATE);
    try {
      localStorage.removeItem(SESSION_LEDGER_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const exportTelemetryJson = useCallback(() => {
    const payload = buildTelemetryExportPayload(ledger);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbonroute-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [ledger]);

  return {
    ledger,
    recordRoutingEvent,
    resetLedger,
    exportTelemetryJson,
  };
}
