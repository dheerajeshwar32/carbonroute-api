// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSessionLedger,
  SESSION_LEDGER_STORAGE_KEY,
  INITIAL_LEDGER_STATE,
  loadLedgerFromStorage,
  applyRoutingEventToLedger,
} from './useSessionLedger';
import type { InferenceSuccessResponse } from '../types/contract';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function makeMockResponse(overrides: Partial<InferenceSuccessResponse> = {}): InferenceSuccessResponse {
  return {
    success: true,
    status: 'success',
    meta: {
      request_id: 'req-1234-5678',
      timestamp: '2026-11-26T12:00:00.000Z',
      version: 'v1',
    },
    request_id: 'req-1234-5678',
    cache_hit: false,
    execution_mode: 'simulated',
    model: 'gemini-3.8-flash',
    routed_to: 'europe-north1',
    location: 'Finland',
    telemetry: {
      latency_ms: 140,
      network_rtt_ms: 155,
      latency_source: 'measured',
      cost_per_1k_tokens: 0.0004,
      live_carbon_intensity: 45,
      carbon_intensity: 45,
      carbon_source: 'live',
      carbon_updated_at: '2026-11-26T12:00:00.000Z',
    },
    impact: {
      baseline_region: 'ap-south-1',
      baseline_location: 'Mumbai',
      baseline_carbon_intensity: 620,
      carbon_saved_pct: 92.7,
      estimated_emissions_g: 0.0108,
      estimated_emissions_avoided_g: 0.138,
      energy_per_request_wh: 0.24,
    },
    routing: {
      policy: {
        max_latency_ms: 200,
        carbon_weight: 0.5,
        cost_weight: 0.35,
        latency_weight: 0.15,
      },
      baseline_region: 'ap-south-1',
      candidates: [
        {
          id: 'europe-north1',
          location: 'Finland',
          grid_zone: 'FI',
          latency_ms: 155,
          latency_source: 'measured',
          latency_updated_at: null,
          carbon_intensity: 45,
          carbon_source: 'live',
          carbon_updated_at: null,
          cost_per_1k_tokens: 0.0004,
          normalized_carbon: 0,
          normalized_cost: 0.3333,
          normalized_latency: 0.8571,
          score: 0.2452,
          rank: 1,
          status: 'selected',
        },
        {
          id: 'ap-south-1',
          location: 'Mumbai',
          grid_zone: 'IN-WE',
          latency_ms: 35,
          latency_source: 'measured',
          latency_updated_at: null,
          carbon_intensity: 620,
          carbon_source: 'live',
          carbon_updated_at: null,
          cost_per_1k_tokens: 0.0006,
          normalized_carbon: 1,
          normalized_cost: 1,
          normalized_latency: 0,
          score: 0.85,
          rank: 2,
          status: 'eligible',
        },
      ],
    },
    usage: { prompt_tokens: 10, output_tokens: 20 },
    data: 'Green routed completion.',
    ...overrides,
  };
}

describe('useSessionLedger Hook & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recovers gracefully from corrupt localStorage JSON', () => {
    localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, '{not-valid-json');
    expect(loadLedgerFromStorage()).toEqual(INITIAL_LEDGER_STATE);
  });

  it('computes avoided emissions accurately for cache miss and cache hit transitions', () => {
    const missResp = makeMockResponse({ cache_hit: false });
    const afterMiss = applyRoutingEventToLedger(INITIAL_LEDGER_STATE, missResp, 'First prompt');

    // Worst case: 0.24 * 620 / 1000 = 0.1488g; actual: 0.0108g; saved = 0.138g
    expect(afterMiss.totalRequests).toBe(1);
    expect(afterMiss.cacheHits).toBe(0);
    expect(afterMiss.cacheHitRatio).toBe(0);
    expect(afterMiss.cumulativeEmissionsSavedG).toBe(0.138);
    expect(afterMiss.cumulativeEmissionsGeneratedG).toBe(0.0108);

    const hitResp = makeMockResponse({
      cache_hit: true,
      routed_to: 'cache',
      execution_mode: 'cache',
      telemetry: {
        latency_ms: 5,
        network_rtt_ms: 0,
        latency_source: 'measured',
        cost_per_1k_tokens: 0,
        live_carbon_intensity: 0,
        carbon_intensity: 0,
        carbon_source: 'live',
        carbon_updated_at: null,
      },
    });
    const afterHit = applyRoutingEventToLedger(afterMiss, hitResp, 'First prompt');

    // Cache hit generates 0g, saves full 0.1488g -> 0.138 + 0.1488 = 0.2868g
    expect(afterHit.totalRequests).toBe(2);
    expect(afterHit.cacheHits).toBe(1);
    expect(afterHit.cacheHitRatio).toBe(50);
    expect(afterHit.cumulativeEmissionsSavedG).toBe(0.2868);
    expect(afterHit.cumulativeEmissionsGeneratedG).toBe(0.0108);
  });

  it('persists across hook mounts and clears localStorage on resetLedger', () => {
    let hookApi!: ReturnType<typeof useSessionLedger>;
    function TestHarness() {
      hookApi = useSessionLedger();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(TestHarness));
    });

    expect(hookApi.ledger.totalRequests).toBe(0);

    act(() => {
      hookApi.recordRoutingEvent(makeMockResponse(), 'Persist test');
    });

    expect(hookApi.ledger.totalRequests).toBe(1);

    const persistedRaw = localStorage.getItem(SESSION_LEDGER_STORAGE_KEY);
    expect(persistedRaw).not.toBeNull();
    expect(JSON.parse(persistedRaw!).totalRequests).toBe(1);

    // Unmount and re-mount to prove localStorage round-trip hydration
    act(() => {
      root.unmount();
    });

    const root2 = createRoot(container);
    act(() => {
      root2.render(React.createElement(TestHarness));
    });

    expect(hookApi.ledger.totalRequests).toBe(1);
    expect(hookApi.ledger.history[0].prompt).toBe('Persist test');

    act(() => {
      hookApi.resetLedger();
    });

    expect(hookApi.ledger).toEqual(INITIAL_LEDGER_STATE);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();

    act(() => {
      root2.unmount();
    });
    document.body.removeChild(container);
  });
});
