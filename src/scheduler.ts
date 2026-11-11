import { RegionSnapshot } from './regions';
import { SLAViolationError } from './errors';

export interface SLAConfig {
    max_latency_ms: number;
    carbon_priority_weight?: number;  // 0.0 to 1.0 (defaults to 0.5 if omitted)
    cost_priority_weight?: number;    // 0.0 to 1.0 (defaults to 0.35 if omitted)
    latency_priority_weight?: number; // 0.0 to 1.0 (defaults to 0.15 if omitted)
}

export interface Candidate {
    region: RegionSnapshot;
    normalizedCost: number;
    normalizedCarbon: number;
    normalizedLatency: number;
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
        latencyWeight: number;
    };
    baseline: RegionSnapshot;
    ranked: Candidate[];
    excluded: ExcludedRegion[];
}

const round = (val: number, digits = 4): number => {
    const factor = 10 ** digits;
    return Math.round(val * factor) / factor;
};

// Intrinsic reference ceilings for single-candidate or zero-variance dimensions
const MAX_REF_CARBON = 800; // gCO2e/kWh (upper threshold for dirtiest coal grids)
const MAX_REF_COST = 0.005;  // $ per 1k tokens benchmark ceiling

export function selectOptimalRegion(
    regions: RegionSnapshot[],
    sla: SLAConfig
): RoutingDecision {
    if (!regions || regions.length === 0) {
        throw new SLAViolationError("No cloud regions currently available in telemetry pool.");
    }

    // Baseline is the closest region (lowest ping latency to client)
    const baseline = regions.reduce((best, curr) => (curr.latencyMs < best.latencyMs ? curr : best));

    const excluded: ExcludedRegion[] = [];
    const eligibleRegions: RegionSnapshot[] = [];

    // 1. Hard SLA Filter: drop regions that exceed max latency limit
    for (const r of regions) {
        if (r.latencyMs > sla.max_latency_ms) {
            excluded.push({
                region: r,
                reason: `Latency ${r.latencyMs}ms exceeds SLA limit of ${sla.max_latency_ms}ms`,
            });
        } else {
            eligibleRegions.push(r);
        }
    }

    if (eligibleRegions.length === 0) {
        throw new SLAViolationError(
            `No available region satisfies the latency SLA constraint of ${sla.max_latency_ms}ms.`
        );
    }

    // 2. Weight validation & simplex normalization
    const rawCarbon = sla.carbon_priority_weight ?? 0.5;
    const rawCost = sla.cost_priority_weight ?? 0.35;
    const rawLatency = sla.latency_priority_weight ?? 0.15;

    if (rawCarbon < 0 || rawCost < 0 || rawLatency < 0) {
        throw new RangeError("Weights cannot be negative");
    }

    const totalWeight = rawCarbon + rawCost + rawLatency;
    if (totalWeight <= 0) {
        throw new RangeError("Total priority weights must be greater than zero");
    }

    // Simplex normalization so weights sum exactly to 1.0
    const wCarbonNorm = rawCarbon / totalWeight;
    const wCostNorm = rawCost / totalWeight;
    const wLatencyNorm = rawLatency / totalWeight;

    // 3. Min/Max bounds across eligible candidates
    const minCost = Math.min(...eligibleRegions.map(r => r.costPer1kTokens));
    const maxCost = Math.max(...eligibleRegions.map(r => r.costPer1kTokens));

    const minCarbon = Math.min(...eligibleRegions.map(r => r.carbonIntensity));
    const maxCarbon = Math.max(...eligibleRegions.map(r => r.carbonIntensity));

    const minLatency = Math.min(...eligibleRegions.map(r => r.latencyMs));
    const maxLatency = Math.max(...eligibleRegions.map(r => r.latencyMs));

    const maxRefLatency = Math.max(1, sla.max_latency_ms);

    // 4. Continuous multi-objective scoring
    const evaluated: Candidate[] = eligibleRegions.map(region => {
        // Normalized Cost (0 = cheapest, 1 = most expensive)
        const normCost = maxCost === minCost
            ? Math.min(1, Math.max(0, region.costPer1kTokens / MAX_REF_COST))
            : (region.costPer1kTokens - minCost) / (maxCost - minCost);

        // Normalized Carbon (0 = cleanest, 1 = dirtiest)
        const normCarbon = maxCarbon === minCarbon
            ? Math.min(1, Math.max(0, region.carbonIntensity / MAX_REF_CARBON))
            : (region.carbonIntensity - minCarbon) / (maxCarbon - minCarbon);

        // Normalized Latency (0 = lowest latency, 1 = highest latency)
        const normLatency = maxLatency === minLatency
            ? Math.min(1, Math.max(0, region.latencyMs / maxRefLatency))
            : (region.latencyMs - minLatency) / (maxLatency - minLatency);

        // Full 3-objective composite scalar score
        const score = (wCostNorm * normCost) + (wCarbonNorm * normCarbon) + (wLatencyNorm * normLatency);

        return {
            region,
            normalizedCost: round(normCost),
            normalizedCarbon: round(normCarbon),
            normalizedLatency: round(normLatency),
            score: round(score),
            rank: 0, // Assigned after sorting
        };
    });

    // 5. Rank ascending: lowest composite score is optimal
    evaluated.sort((a, b) => a.score - b.score);
    evaluated.forEach((c, idx) => {
        c.rank = idx + 1;
    });

    return {
        selected: evaluated[0],
        policy: {
            maxLatencyMs: sla.max_latency_ms,
            carbonWeight: round(wCarbonNorm),
            costWeight: round(wCostNorm),
            latencyWeight: round(wLatencyNorm),
        },
        baseline,
        ranked: evaluated,
        excluded,
    };
}
