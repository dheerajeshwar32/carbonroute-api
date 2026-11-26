import { useMemo } from 'react';
import type { RegionSnapshot } from '../types/contract';
import {
  getDominantObjective,
  getObjectiveAccentClass,
  scoreLiveRegions,
} from '../utils/schedulerPreview';
import { Activity } from './Icons';

export interface TelemetryRailProps {
  regions: RegionSnapshot[];
  maxLatency: number;
  carbonWeight: number;
  costWeight: number;
  latencyWeight: number;
}

interface OrderedRegionItem {
  region: RegionSnapshot;
  isOptimal: boolean;
  isBreached: boolean;
  rank: number | null;
}

export function TelemetryRail({
  regions,
  maxLatency,
  carbonWeight,
  costWeight,
  latencyWeight,
}: TelemetryRailProps) {
  const orderedRegions = useMemo<OrderedRegionItem[]>(() => {
    if (!regions || regions.length === 0) return [];

    const ranked = scoreLiveRegions(regions, {
      max_latency_ms: maxLatency,
      carbon_priority_weight: carbonWeight / 100,
      cost_priority_weight: costWeight / 100,
      latency_priority_weight: latencyWeight / 100,
    });

    const rankById = new Map<string, number>();
    ranked.forEach((entry, idx) => rankById.set(entry.id, idx + 1));

    const regionById = new Map<string, RegionSnapshot>();
    regions.forEach((r) => regionById.set(r.id, r));

    const items: OrderedRegionItem[] = [];

    // Ranked eligible regions first
    for (const entry of ranked) {
      const region = regionById.get(entry.id);
      if (!region) continue;
      const rank = rankById.get(entry.id) ?? null;
      items.push({
        region,
        isOptimal: rank === 1,
        isBreached: false,
        rank,
      });
    }

    // SLA-breaching regions sorted cleanly by latency ascending
    const breached = regions
      .filter((r) => !rankById.has(r.id))
      .sort((a, b) => a.latency_ms - b.latency_ms);

    for (const r of breached) {
      items.push({
        region: r,
        isOptimal: false,
        isBreached: r.latency_ms > maxLatency,
        rank: null,
      });
    }

    return items;
  }, [regions, maxLatency, carbonWeight, costWeight, latencyWeight]);

  const dominantObjective = useMemo(
    () => getDominantObjective(carbonWeight, costWeight, latencyWeight),
    [carbonWeight, costWeight, latencyWeight]
  );
  const policyModifier = `policy-${dominantObjective}`;
  const headerAccentClass = getObjectiveAccentClass(dominantObjective);

  const maxScaleMs = useMemo(() => {
    if (!regions || regions.length === 0) return Math.max(250, maxLatency);
    return Math.max(250, maxLatency, ...regions.map((r) => r.latency_ms));
  }, [regions, maxLatency]);

  const cutoffPct = Math.min(100, Math.max(0, (maxLatency / maxScaleMs) * 100));
  const hideLeftBound = cutoffPct < 20;
  const hideRightBound = cutoffPct > 76;
  const cutoffLabelTransform =
    cutoffPct < 10
      ? 'translate(0%, -50%)'
      : cutoffPct > 90
        ? 'translate(-100%, -50%)'
        : 'translate(-50%, -50%)';

  return (
    <section className="surface-card telemetry-rail-card" aria-label="Global region telemetry and latency SLA">
      <div className="panel-header-row">
        <div className="panel-heading-group">
          <Activity size={14} className={headerAccentClass} />
          <h2 className="panel-title">Grid &amp; Latency Envelope</h2>
        </div>
        <span className="panel-count-pill mono-tabular">{regions.length} zones</span>
      </div>

      {regions.length === 0 ? (
        <div className="rail-skeleton-list" aria-busy="true" aria-label="Loading region telemetry">
          <div className="skeleton-line" style={{ height: '38px' }} />
          <div className="skeleton-line" style={{ height: '38px' }} />
          <div className="skeleton-line" style={{ height: '38px' }} />
        </div>
      ) : (
        <>
          {/* Synchronized Latency Axis & Live SLA Cutoff Scale */}
          <div className="sla-scale-bar">
            <div className="sla-scale-track-area">
              <span
                className={`sla-scale-bound mono-tabular${hideLeftBound ? ' sla-scale-bound-hidden' : ''}`}
                aria-hidden={hideLeftBound || undefined}
              >
                0ms
              </span>
              <span
                className="sla-cutoff-readout mono-tabular"
                style={{ left: `${cutoffPct}%`, transform: cutoffLabelTransform }}
              >
                {maxLatency}ms SLA
              </span>
              <span
                className={`sla-scale-bound mono-tabular${hideRightBound ? ' sla-scale-bound-hidden' : ''}`}
                aria-hidden={hideRightBound || undefined}
              >
                {maxScaleMs}ms
              </span>
            </div>
            <span className="sla-scale-spacer" aria-hidden="true" />
          </div>

          <ul className="region-rows-list">
            {orderedRegions.map(({ region, isOptimal, isBreached }) => {
              const carbon = region.carbon_intensity;
              const carbonClass =
                carbon < 100
                  ? 'carbon-mint'
                  : carbon <= 300
                    ? 'carbon-amber'
                    : 'carbon-coral';

              const fillPct = Math.min(100, Math.max(2, (region.latency_ms / maxScaleMs) * 100));

              return (
                <li
                  key={region.id}
                  className={`region-row ${isOptimal ? `region-row-optimal ${policyModifier}` : ''} ${
                    isBreached ? 'region-row-breached' : ''
                  }`}
                >
                  {/* Line 1: Identity & Carbon Pill + Rank Tag */}
                  <div className="region-row-top">
                    <div className="region-identity">
                      <span className="region-name">{region.location}</span>
                      <span className="region-id mono-tabular">{region.id}</span>
                    </div>

                    <div className="region-badges">
                      <span className={`carbon-pill mono-tabular ${carbonClass}`}>
                        {carbon} gCO₂e/kWh
                      </span>
                      {isOptimal && <span className={`tag-optimal ${policyModifier}`}>OPTIMAL</span>}
                      {isBreached && <span className="tag-breach-muted">SLA BREACH</span>}
                    </div>
                  </div>

                  {/* Line 2: Shared Scale Bar Track + Synchronized SLA Cutoff Marker */}
                  <div className="region-row-track-line">
                    <div className="latency-track">
                      <div
                        className={`latency-fill ${
                          isOptimal
                            ? `latency-fill-optimal ${policyModifier}`
                            : isBreached
                              ? 'latency-fill-breached'
                              : ''
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                      <span
                        className="latency-cutoff-marker"
                        style={{ left: `${cutoffPct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="latency-readout mono-tabular">{region.latency_ms} ms</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
