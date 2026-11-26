import { describe, it, expect } from 'vitest';
import {
  computeLiveRegionProjection,
  scoreLiveRegions,
  DEFAULT_COST_PER_1K_TOKENS,
  MAX_REF_CARBON,
  MAX_REF_COST,
} from './schedulerPreview';
import type { RegionSnapshot } from '../types/contract';

const mockRegions: RegionSnapshot[] = [
  {
    id: 'us-east-1',
    location: 'N. Virginia',
    grid_zone: 'US-MIDA-PJM',
    latency_ms: 100,
    latency_source: 'measured',
    latency_updated_at: '2026-11-26T00:00:00.000Z',
    carbon_intensity: 400,
    carbon_source: 'live',
    carbon_updated_at: '2026-11-26T00:00:00.000Z',
    cost_per_1k_tokens: 0.001,
  },
  {
    id: 'eu-west-1',
    location: 'Ireland',
    grid_zone: 'IE',
    latency_ms: 250,
    latency_source: 'measured',
    latency_updated_at: '2026-11-26T00:00:00.000Z',
    carbon_intensity: 50,
    carbon_source: 'live',
    carbon_updated_at: '2026-11-26T00:00:00.000Z',
    cost_per_1k_tokens: 0.0012,
  },
  {
    id: 'ap-south-1',
    location: 'Mumbai',
    grid_zone: 'IN-WE',
    latency_ms: 150,
    latency_source: 'measured',
    latency_updated_at: '2026-11-26T00:00:00.000Z',
    carbon_intensity: 700,
    carbon_source: 'live',
    carbon_updated_at: '2026-11-26T00:00:00.000Z',
    cost_per_1k_tokens: 0.0008,
  },
];

describe('schedulerPreview (1:1 Parity with Backend Scheduler)', () => {
  it('excludes regions exceeding max_latency_ms', () => {
    const ranked = scoreLiveRegions(mockRegions, {
      max_latency_ms: 200,
      carbon_priority_weight: 1,
      cost_priority_weight: 0,
      latency_priority_weight: 0,
    });
    expect(ranked.map((r) => r.id)).not.toContain('eu-west-1');
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe('us-east-1');
  });

  it('matches dominant single-objective winners (carbon, cost, latency)', () => {
    expect(
      computeLiveRegionProjection(mockRegions, {
        max_latency_ms: 300,
        carbon_priority_weight: 1,
        cost_priority_weight: 0,
        latency_priority_weight: 0,
      })
    ).toBe('eu-west-1');

    expect(
      computeLiveRegionProjection(mockRegions, {
        max_latency_ms: 300,
        carbon_priority_weight: 0,
        cost_priority_weight: 1,
        latency_priority_weight: 0,
      })
    ).toBe('ap-south-1');

    expect(
      computeLiveRegionProjection(mockRegions, {
        max_latency_ms: 300,
        carbon_priority_weight: 0,
        cost_priority_weight: 0,
        latency_priority_weight: 1,
      })
    ).toBe('us-east-1');
  });

  it('produces identical normalized scores for equivalent unnormalized vs simplex-normalized weights', () => {
    const unnormalized = scoreLiveRegions(mockRegions, {
      max_latency_ms: 300,
      carbon_priority_weight: 2,
      cost_priority_weight: 2,
      latency_priority_weight: 1,
    });
    const normalized = scoreLiveRegions(mockRegions, {
      max_latency_ms: 300,
      carbon_priority_weight: 0.4,
      cost_priority_weight: 0.4,
      latency_priority_weight: 0.2,
    });

    expect(unnormalized).toEqual(normalized);
  });

  it('uses reference ceilings matching backend when only one candidate meets SLA', () => {
    const single = scoreLiveRegions(mockRegions, {
      max_latency_ms: 120,
      carbon_priority_weight: 0.5,
      cost_priority_weight: 0.5,
      latency_priority_weight: 0.5,
    });

    expect(single).toHaveLength(1);
    expect(single[0].id).toBe('us-east-1');
    expect(single[0].normalizedCarbon).toBe(400 / MAX_REF_CARBON); // 0.5
    expect(single[0].normalizedCost).toBe(0.001 / MAX_REF_COST); // 0.2
    expect(single[0].normalizedLatency).toBeCloseTo(100 / 120, 4);
  });

  it('aligns omitted cost_per_1k_tokens fallback to backend baseline median (0.0004)', () => {
    expect(DEFAULT_COST_PER_1K_TOKENS).toBe(0.0004);
    const regionWithoutCost = [
      { ...mockRegions[0], cost_per_1k_tokens: undefined as unknown as number },
    ];
    const single = scoreLiveRegions(regionWithoutCost, {
      max_latency_ms: 200,
      carbon_priority_weight: 0,
      cost_priority_weight: 1,
      latency_priority_weight: 0,
    });
    expect(single[0].normalizedCost).toBe(Number((0.0004 / MAX_REF_COST).toFixed(4)));
  });

  it('returns null safely for empty regions, SLA violation, or zero total weights', () => {
    expect(computeLiveRegionProjection([], { max_latency_ms: 200 })).toBeNull();
    expect(computeLiveRegionProjection(mockRegions, { max_latency_ms: 10 })).toBeNull();
    expect(
      computeLiveRegionProjection(mockRegions, {
        max_latency_ms: 300,
        carbon_priority_weight: 0,
        cost_priority_weight: 0,
        latency_priority_weight: 0,
      })
    ).toBeNull();
  });
});
