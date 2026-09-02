import { CloudRegion } from './regions';

export interface SLAConfig {
    max_latency_ms: number;
    carbon_priority_weight?: number; // e.g. 0.0 to 1.0 (default 0.5)
    cost_priority_weight?: number;   // e.g. 0.0 to 1.0 (default 0.5)
}

export interface RoutingDecision {
    selectedRegion: CloudRegion;
    score: number;
    consideredRegions: {
        id: string;
        rawCost: number;
        rawCarbon: number;
        latencyMs: number;
        normalizedCost: number;
        normalizedCarbon: number;
        totalScore: number;
    }[];
}

export function selectOptimalRegion(
    regions: CloudRegion[],
    sla: SLAConfig
): RoutingDecision {
    // 1. Hard Constraint Filter: Drop regions that breach max latency
    const eligibleRegions = regions.filter(r => r.latencyMs <= sla.max_latency_ms);

    if (eligibleRegions.length === 0) {
        throw new Error(
            `No available region satisfies the latency SLA constraint of ${sla.max_latency_ms}ms.`
        );
    }

    // Default weights if not provided
    const wCarbon = sla.carbon_priority_weight ?? 0.5;
    const wCost = sla.cost_priority_weight ?? 0.5;

    // 2. Find Min and Max values among eligible regions for normalization
    const minCost = Math.min(...eligibleRegions.map(r => r.costPer1kTokens));
    const maxCost = Math.max(...eligibleRegions.map(r => r.costPer1kTokens));

    const minCarbon = Math.min(...eligibleRegions.map(r => r.carbonIntensity));
    const maxCarbon = Math.max(...eligibleRegions.map(r => r.carbonIntensity));

    // 3. Score every eligible region
    const evaluated = eligibleRegions.map(region => {
        // Normalize Cost: 0 = cheapest, 1 = most expensive
        const normCost = maxCost === minCost 
            ? 0 
            : (region.costPer1kTokens - minCost) / (maxCost - minCost);

        // Normalize Carbon: 0 = cleanest, 1 = dirtiest
        const normCarbon = maxCarbon === minCarbon 
            ? 0 
            : (region.carbonIntensity - minCarbon) / (maxCarbon - minCarbon);

        // Composite scalar score (lower is better)
        const totalScore = (wCost * normCost) + (wCarbon * normCarbon);

        return {
            region,
            rawCost: region.costPer1kTokens,
            rawCarbon: region.carbonIntensity,
            latencyMs: region.latencyMs,
            normalizedCost: normCost,
            normalizedCarbon: normCarbon,
            totalScore
        };
    });

    // 4. Sort ascending: Lowest score is optimal
    evaluated.sort((a, b) => a.totalScore - b.totalScore);

    const winner = evaluated[0];

    return {
        selectedRegion: winner.region,
        score: winner.totalScore,
        consideredRegions: evaluated.map(e => ({
            id: e.region.id,
            rawCost: e.rawCost,
            rawCarbon: e.rawCarbon,
            latencyMs: e.latencyMs,
            normalizedCost: e.normalizedCost,
            normalizedCarbon: e.normalizedCarbon,
            totalScore: e.totalScore
        }))
    };
}