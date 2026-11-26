import type { RegionSnapshot, SLAConfigPayload } from '../types/contract';

/**
 * Intrinsic reference ceilings — aligned 1:1 with carbonroute-proxy/src/scheduler.ts
 */
export const MAX_REF_CARBON = 800; // gCO2e/kWh
export const MAX_REF_COST = 0.005; // $ per 1k tokens
export const DEFAULT_COST_PER_1K_TOKENS = 0.0004; // Median of backend baseline regions

export interface RegionProjectionScore {
  id: string;
  normalizedCost: number;
  normalizedCarbon: number;
  normalizedLatency: number;
  score: number;
}

function round(val: number, digits = 4): number {
  return Number(val.toFixed(digits));
}

/**
 * Computes scored rankings across all SLA-eligible regions in a single extrema pass.
 * Exact 1:1 parity with `selectOptimalRegion` in `carbonroute-proxy/src/scheduler.ts`.
 */
export function scoreLiveRegions(
  regions: RegionSnapshot[],
  sla: SLAConfigPayload
): RegionProjectionScore[] {
  if (!Array.isArray(regions) || regions.length === 0) return [];

  // 1. Hard SLA filter: drop regions where latency exceeds limit
  const eligible: RegionSnapshot[] = [];
  for (const r of regions) {
    if (r.latency_ms <= sla.max_latency_ms) {
      eligible.push(r);
    }
  }
  if (eligible.length === 0) return [];

  // 2. Weight validation & simplex normalization
  const rawCarbon = sla.carbon_priority_weight ?? 0.5;
  const rawCost = sla.cost_priority_weight ?? 0.35;
  const rawLatency = sla.latency_priority_weight ?? 0.15;

  if (rawCarbon < 0 || rawCost < 0 || rawLatency < 0) return [];

  const total = rawCarbon + rawCost + rawLatency;
  if (total <= 0) return [];

  const wCarbonNorm = rawCarbon / total;
  const wCostNorm = rawCost / total;
  const wLatencyNorm = rawLatency / total;

  // 3. Single-pass extrema computation (zero intermediate array allocations)
  let minCost = Infinity;
  let maxCost = -Infinity;
  let minCarbon = Infinity;
  let maxCarbon = -Infinity;
  let minLatency = Infinity;
  let maxLatency = -Infinity;

  for (const r of eligible) {
    const cost = r.cost_per_1k_tokens ?? DEFAULT_COST_PER_1K_TOKENS;
    const carbon = r.carbon_intensity;
    const latency = r.latency_ms;

    if (cost < minCost) minCost = cost;
    if (cost > maxCost) maxCost = cost;
    if (carbon < minCarbon) minCarbon = carbon;
    if (carbon > maxCarbon) maxCarbon = carbon;
    if (latency < minLatency) minLatency = latency;
    if (latency > maxLatency) maxLatency = latency;
  }

  const maxRefLatency = Math.max(1, sla.max_latency_ms);

  // 4. Multi-objective composite scoring with 4-decimal IEEE 754 stabilization
  const scored: RegionProjectionScore[] = eligible.map((region) => {
    const cost = region.cost_per_1k_tokens ?? DEFAULT_COST_PER_1K_TOKENS;
    const carbon = region.carbon_intensity;
    const latency = region.latency_ms;

    const normCost = maxCost === minCost
      ? Math.min(1, Math.max(0, cost / MAX_REF_COST))
      : (cost - minCost) / (maxCost - minCost);

    const normCarbon = maxCarbon === minCarbon
      ? Math.min(1, Math.max(0, carbon / MAX_REF_CARBON))
      : (carbon - minCarbon) / (maxCarbon - minCarbon);

    const normLatency = maxLatency === minLatency
      ? Math.min(1, Math.max(0, latency / maxRefLatency))
      : (latency - minLatency) / (maxLatency - minLatency);

    const score = (wCostNorm * normCost) + (wCarbonNorm * normCarbon) + (wLatencyNorm * normLatency);

    return {
      id: region.id,
      normalizedCost: round(normCost),
      normalizedCarbon: round(normCarbon),
      normalizedLatency: round(normLatency),
      score: round(score),
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored;
}

/**
 * Projects the single optimal region ID from live telemetry and active SLA weights.
 */
export function computeLiveRegionProjection(
  regions: RegionSnapshot[],
  sla: SLAConfigPayload
): string | null {
  const ranked = scoreLiveRegions(regions, sla);
  return ranked[0]?.id ?? null;
}
