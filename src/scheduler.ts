import { RegionSnapshot } from './regions';
import { SLAViolationError } from './errors';

export interface SLAConfig {
    max_latency_ms: number;
    carbon_priority_weight?: number; // e.g. 0.0 to 1.0 (default 0.5)
    cost_priority_weight?: number;   // e.g. 0.0 to 1.0 (default 0.5)
}

export interface Candidate {
    region: RegionSnapshot;
    normalizedCost: number;
    normalizedCarbon: number;
    score: number;
    rank: number;
}

export interface ExcludedRegion {
    region: RegionSnapshot;
    reason: string;
}

export interface RoutingDecision {
    selected: Candidate;
    policy: {
        maxLatencyMs: number;
        carbonWeight: number;
        costWeight: number;
    };
    baseline: RegionSnapshot;
    ranked: Candidate[];
    excluded: ExcludedRegion[];
}

export function selectOptimalRegion(
    regions: RegionSnapshot[],
    sla: SLAConfig
): RoutingDecision {
    if (!regions.length) throw new Error("No regions available.");
    
    // Baseline is typically the region with the lowest latency (closest to user)
    const baseline = regions.reduce((a, b) => b.latencyMs < a.latencyMs ? b : a);

    const excluded: ExcludedRegion[] = [];
    const eligibleRegions: RegionSnapshot[] = [];

    // 1. Hard Constraint Filter: Drop regions that breach max latency
    for (const r of regions) {
        if (r.latencyMs > sla.max_latency_ms) {
            excluded.push({ region: r, reason: `Latency ${r.latencyMs}ms exceeds max ${sla.max_latency_ms}ms` });
        } else {
            eligibleRegions.push(r);
        }
    }

    if (eligibleRegions.length === 0) {
        throw new SLAViolationError(
            `No available region satisfies the latency SLA constraint of ${sla.max_latency_ms}ms.`
        );
    }

    // Default weights if not provided
    const wCarbon = sla.carbon_priority_weight ?? 0.5;
    const wCost = sla.cost_priority_weight ?? 0.5;
    
    if (wCarbon < 0 || wCost < 0) {
        throw new RangeError("Weights cannot be negative");
    }

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
        const score = (wCost * normCost) + (wCarbon * normCarbon);

        return {
            region,
            normalizedCost: normCost,
            normalizedCarbon: normCarbon,
            score,
            rank: 0 // Will be set after sorting
        };
    });

    // 4. Sort ascending: Lowest score is optimal
    evaluated.sort((a, b) => a.score - b.score);
    
    evaluated.forEach((c, i) => { c.rank = i + 1; });

    return {
        selected: evaluated[0],
        policy: {
            maxLatencyMs: sla.max_latency_ms,
            carbonWeight: wCarbon,
            costWeight: wCost
        },
        baseline,
        ranked: evaluated,
        excluded
    };
}