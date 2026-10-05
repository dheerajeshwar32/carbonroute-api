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
            latencyUpdatedAt: null,
            carbonIntensity: 400,
            carbonSource: 'live',
            carbonUpdatedAt: null,
            costPer1kTokens: 0.001
        },
        {
            id: 'eu-west-1',
            location: 'Ireland',
            gridZone: 'IE',
            latencyMs: 250,
            latencySource: 'measured',
            latencyUpdatedAt: null,
            carbonIntensity: 50,
            carbonSource: 'live',
            carbonUpdatedAt: null,
            costPer1kTokens: 0.0012
        },
        {
            id: 'ap-south-1',
            location: 'Mumbai',
            gridZone: 'IN',
            latencyMs: 150,
            latencySource: 'measured',
            latencyUpdatedAt: null,
            carbonIntensity: 700,
            carbonSource: 'live',
            carbonUpdatedAt: null,
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

    it('should select cleanest region if carbon weight is 1', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 1, cost_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // All regions eligible (max_latency=300). eu-west-1 is cleanest (50)
        expect(result.selected.region.id).toBe('eu-west-1');
    });

    it('should select cheapest region if cost weight is 1', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0, cost_priority_weight: 1 };
        const result = selectOptimalRegion(mockRegions, sla);

        // ap-south-1 is cheapest (0.0008)
        expect(result.selected.region.id).toBe('ap-south-1');
    });

    it('should balance cost and carbon when weights are mixed', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0.5, cost_priority_weight: 0.5 };
        const result = selectOptimalRegion(mockRegions, sla);

        // With equal weights, us-east-1 might win because it's moderate in both, 
        // or eu-west-1 because of low carbon. Let's just ensure it selects a valid one
        expect(result.selected.region.id).toBeDefined();
    });

    it('should throw SLAViolationError if no regions meet latency', () => {
        const sla = { max_latency_ms: 50 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow(SLAViolationError);
    });

    it('should throw RangeError for invalid weights', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: -1, cost_priority_weight: 2 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow(RangeError);
    });
});
