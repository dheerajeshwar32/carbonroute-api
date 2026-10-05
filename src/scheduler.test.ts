import { describe, it, expect } from 'vitest';
import { selectOptimalRegion } from './scheduler';
import { CloudRegion } from './regions';

describe('selectOptimalRegion', () => {
    const mockRegions: CloudRegion[] = [
        {
            id: 'us-east-1',
            location: 'Virginia',
            gridZone: 'PJM',
            latencyMs: 100,
            costPer1kTokens: 0.001,
            carbonIntensity: 400
        },
        {
            id: 'eu-west-1',
            location: 'Ireland',
            gridZone: 'IE',
            latencyMs: 250,
            costPer1kTokens: 0.0012,
            carbonIntensity: 50
        },
        {
            id: 'ap-south-1',
            location: 'Mumbai',
            gridZone: 'IN',
            latencyMs: 150,
            costPer1kTokens: 0.0008,
            carbonIntensity: 700
        }
    ];

    it('should drop regions that breach max latency', () => {
        const sla = { max_latency_ms: 200, carbon_priority_weight: 1, cost_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // eu-west-1 is 250ms, so it should be excluded
        expect(result.consideredRegions).toHaveLength(2);
        // It shouldn't include eu-west-1
        expect(result.consideredRegions.find(r => r.id === 'eu-west-1')).toBeUndefined();
    });

    it('should select cleanest region if carbon weight is 1', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 1, cost_priority_weight: 0 };
        const result = selectOptimalRegion(mockRegions, sla);

        // All regions eligible (max_latency=300). eu-west-1 is cleanest (50)
        expect(result.selectedRegion.id).toBe('eu-west-1');
    });

    it('should select cheapest region if cost weight is 1', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0, cost_priority_weight: 1 };
        const result = selectOptimalRegion(mockRegions, sla);

        // ap-south-1 is cheapest (0.0008)
        expect(result.selectedRegion.id).toBe('ap-south-1');
    });

    it('should balance cost and carbon when weights are mixed', () => {
        const sla = { max_latency_ms: 300, carbon_priority_weight: 0.5, cost_priority_weight: 0.5 };
        const result = selectOptimalRegion(mockRegions, sla);

        expect(result.selectedRegion.id).toBeDefined();
    });

    it('should throw error if no regions meet latency', () => {
        const sla = { max_latency_ms: 50 };
        expect(() => selectOptimalRegion(mockRegions, sla)).toThrow('No available region satisfies the latency SLA constraint of 50ms.');
    });
});
