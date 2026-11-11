import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'carbonroute_session_ledger_v1';
const ENERGY_WH = 0.24; // Standard Google Gemini text energy draw per request

const round = (num, digits = 4) => Number(Number(num || 0).toFixed(digits));

const INITIAL_STATE = {
  totalRequests: 0,
  cacheHits: 0,
  cacheHitRatio: 0,
  cumulativeEmissionsSavedG: 0,
  cumulativeEmissionsGeneratedG: 0,
  history: [],
};

export function useSessionLedger() {
  const [ledger, setLedger] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.totalRequests === 'number') {
          return parsed;
        }
      }
    } catch {
      // Fallback on corrupt storage
    }
    return INITIAL_STATE;
  });

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
    } catch (e) {
      console.warn('Failed to save session ledger to localStorage', e);
    }
  }, [ledger]);

  const recordRoutingEvent = useCallback((result, prompt) => {
    if (!result || !result.telemetry) return;

    const isCache = Boolean(result.cache_hit);
    const candidates = result.routing?.candidates || [];

    // Find highest-carbon candidate evaluated in this routing decision
    const highestCarbonCandidate = candidates.reduce(
      (max, curr) => (curr.carbon_intensity > max.carbon_intensity ? curr : max),
      candidates[0] || { carbon_intensity: 500, location: 'Standard Coal Grid', id: 'dirty-baseline' }
    );

    const dirtiestCarbon = highestCarbonCandidate.carbon_intensity || 500;
    const worstCaseEmissionsG = (ENERGY_WH * dirtiestCarbon) / 1000;

    const actualEmissionsG = isCache
      ? 0
      : (result.impact?.estimated_emissions_g ??
         (ENERGY_WH * (result.telemetry.carbon_intensity || result.telemetry.live_carbon_intensity || 0)) / 1000);

    const emissionsSavedG = Math.max(0, worstCaseEmissionsG - actualEmissionsG);

    setLedger((prev) => {
      const newTotal = prev.totalRequests + 1;
      const newCacheHits = prev.cacheHits + (isCache ? 1 : 0);
      const newRatio = round((newCacheHits / newTotal) * 100, 1);
      const newSaved = round(prev.cumulativeEmissionsSavedG + emissionsSavedG, 4);
      const newGen = round(prev.cumulativeEmissionsGeneratedG + actualEmissionsG, 4);

      const newItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: prompt.slice(0, 100),
        model: result.model || 'gemini-3.8-flash',
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
        history: [newItem, ...prev.history].slice(0, 50), // retain last 50 queries
      };
    });
  }, []);

  const resetLedger = useCallback(() => {
    setLedger(INITIAL_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const exportTelemetryJson = useCallback(() => {
    const payload = {
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
