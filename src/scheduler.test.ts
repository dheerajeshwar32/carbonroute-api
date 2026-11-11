import { describe, it, expect } from 'vitest';
import { selectOptimalRegion } from './scheduler';
import { RegionSnapshot } from './regions';
import { SLAViolationError } from './errors';

describe('selectOptimalRegion', () => {
    const mockRegions: RegionSnapshot[] = [
        {
            id: 'us-east-1',
            location: 'Virginia',
            gridZone: 'PJM',
            latencyMs: 100,
            latencySource: 'measured',
            latencyUpdatedAt: '2026-11-11T00:00:00.000Z',
            carbonIntensity: 400,
            carbonSource: 'live',
            carbonUpdatedAt: '2026-11-11T00:00:00.000Z',
            costPer1kTokens: 0.001
        },
        {
            id: 'eu-west-1',
            location: 'Ireland',
            gridZone: 'IE',
            latencyMs: 250,
            latencySource: 'measured',
            latencyUpdatedAt: '2026-11-11T00:00:00.000Z',
            carbonIntensity: 50,
            carbonSource: 'live',
            carbonUpdatedAt: '2026-11-11T00:00:00.000Z',
            costPer1kTokens: 0.0012
        },
        {
            id: 'ap-south-1',
            location: 'Mumbai',
            gridZone: 'IN',
            latencyMs: 150,
            latencySource: 'measured',
            latencyUpdatedAt: '2026-11-11T00:00:00.000Z',
            carbonIntensity: 700,
            carbonSource: 'live',
            carbonUpdatedAt: '2026-11-11T00:00:00.000Z',
            costPer1kTokens: 0.0008
        }
    ];

    it('should drop regions that breach max latency', () => {
        const sla = { max_latency_ms: 200, carbon_priority_weight: 1, cost_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // eu-west-1 is 250ms, so it should be excluded
        expect(result.excluded).toHaveLength(1);
        expect(result.excluded[0].region.id).toBe('eu-west-1');
        expect(result.ranked).toHaveLength(2);
    });

    it('should select cleanest region if carbon weight is dominant', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 1, cost_priority_weight: 0, latency_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // All regions eligible (max_latency=300). eu-west-1 is cleanest (50 gCO2e)
        expect(result.selected.region.id).toBe('eu-west-1');
        expect(result.selected.rank).toBe(1);
    });

    it('should select cheapest region if cost weight is dominant', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0, cost_priority_weight: 1, latency_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // ap-south-1 is cheapest (0.0008)
        expect(result.selected.region.id).toBe('ap-south-1');
    });

    it('should select lowest latency region if latency weight is dominant', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0, cost_priority_weight: 0, latency_priority_weight: 1 };
        const result = selectOptimalRegion(mockRegions, sla);

        // us-east-1 has lowest latency (100ms)
        expect(result.selected.region.id).toBe('us-east-1');
    });

    it('should perform simplex normalization on priority weights', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 2, cost_priority_weight: 2, latency_priority_weight: 1 };
        const result = selectOptimalRegion(mockRegions, sla);

        // Total weight is 5, so normalized weights should sum to 1.0: 0.4, 0.4, 0.2
        expect(result.policy.carbonWeight).toBe(0.4);
        expect(result.policy.costWeight).toBe(0.4);
        expect(result.policy.latencyWeight).toBe(0.2);
    });

    it('should compute intrinsic ratios against reference ceilings when only 1 candidate meets SLA', () => {
        // Only us-east-1 (100ms) meets 120ms SLA
        const sla = { max_latency_ms: 120, carbon_priority_weight: 0.5, cost_priority_weight: 0.5, latency_priority_weight: 0.5 };
        const result = selectOptimalRegion(mockRegions, sla);

        expect(result.ranked).toHaveLength(1);
        expect(result.selected.region.id).toBe('us-east-1');
        // Ratios against MAX_REF_CARBON (800), MAX_REF_COST (0.005), and MAX_REF_LATENCY (120)
        expect(result.selected.score).toBeGreaterThan(0);
        expect(result.selected.normalizedCarbon).toBe(0.5); // 400 / 800
        expect(result.selected.normalizedCost).toBe(0.2);   // 0.001 / 0.005
        expect(result.selected.normalizedLatency).toBeCloseTo(100 / 120, 3);
    });

    it('should eliminate IEEE 754 float jitter with 4 decimal places rounding', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0.333, cost_priority_weight: 0.333, latency_priority_weight: 0.334 };
        const result = selectOptimalRegion(mockRegions, sla);

        for (const candidate of result.ranked) {
            const scoreStr = candidate.score.toString();
            const decimals = scoreStr.includes('.') ? scoreStr.split('.')[1].length : 0;
            expect(decimals).toBeLessThanOrEqual(4);
        }
    });

    it('should throw SLAViolationError if no regions meet latency SLA', () => {
        const sla = { max_latency_ms: 50 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow(SLAViolationError);
    });

    it('should throw RangeError for negative weights', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: -1, cost_priority_weight: 2 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow(RangeError);
    });

    it('should throw RangeError if all weights sum to zero', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0, cost_priority_weight: 0, latency_priority_weight: 0 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow(RangeError);
    });

    it('should throw SLAViolationError if regions array is empty', () => {
        const sla = { max_latency_ms: 300 };
        expect(() => selectOptimalRegion([], sla)).toThrow(SLAViolationError);
    });
});
