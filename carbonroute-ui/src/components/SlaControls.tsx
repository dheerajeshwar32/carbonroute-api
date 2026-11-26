import { memo, useId, type CSSProperties } from 'react';
import type { SLAPreset } from '../types/contract';
import { Sliders } from './Icons';

const PRESET_OPTIONS = [
  { key: 'eco', label: 'Eco Max' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'latency', label: 'Low Latency' },
  { key: 'custom', label: 'Custom' },
] as const;

type SegmentedControlStyle = CSSProperties & {
  '--active-idx': number;
};

const calcPct = (val: number, min: number, max: number): number =>
  Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

export interface SlaControlsProps {
  maxLatency: number;
  setMaxLatency: (val: number) => void;
  carbonWeight: number;
  setCarbonWeight: (val: number) => void;
  costWeight: number;
  setCostWeight: (val: number) => void;
  latencyWeight: number;
  setLatencyWeight: (val: number) => void;
  activePreset: SLAPreset;
  setActivePreset: (preset: SLAPreset) => void;
}

function HairlineSlider({
  id,
  name,
  label,
  readout,
  min,
  max,
  step,
  value,
  fillTone,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  readout: string;
  min: number;
  max: number;
  step: number;
  value: number;
  fillTone: 'default' | 'mint' | 'slate' | 'sky';
  onChange: (nextVal: number) => void;
}) {
  const pct = calcPct(value, min, max);

  return (
    <div className="hairline-slider-group">
      <div className="hairline-slider-header">
        <label htmlFor={id} className="hairline-slider-label">
          {label}
        </label>
        <span className="hairline-slider-readout mono-tabular">{readout}</span>
      </div>

      <div className="hairline-range-wrap">
        <div className="hairline-track-bg" aria-hidden="true">
          <div
            className={`hairline-track-fill tone-${fillTone}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          id={id}
          name={name}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="hairline-range-input"
        />
      </div>
    </div>
  );
}

export const SlaControls = memo(function SlaControls({
  maxLatency,
  setMaxLatency,
  carbonWeight,
  setCarbonWeight,
  costWeight,
  setCostWeight,
  latencyWeight,
  setLatencyWeight,
  activePreset,
  setActivePreset,
}: SlaControlsProps) {
  const latencySliderId = useId();
  const carbonSliderId = useId();
  const costSliderId = useId();
  const latencyWeightSliderId = useId();

  const applyPreset = (preset: SLAPreset) => {
    setActivePreset(preset);
    if (preset === 'eco') {
      setCarbonWeight(85);
      setCostWeight(10);
      setLatencyWeight(5);
    } else if (preset === 'balanced') {
      setCarbonWeight(50);
      setCostWeight(35);
      setLatencyWeight(15);
    } else if (preset === 'latency') {
      setCarbonWeight(15);
      setCostWeight(15);
      setLatencyWeight(70);
    }
  };

  const handleCustomChange = (setter: (val: number) => void, val: number) => {
    setActivePreset('custom');
    setter(val);
  };

  const weightSum = carbonWeight + costWeight + latencyWeight;
  const hasValidWeights = weightSum > 0;
  const normCarbonPct = hasValidWeights ? (carbonWeight / weightSum) * 100 : 0;
  const normCostPct = hasValidWeights ? (costWeight / weightSum) * 100 : 0;
  const normLatencyPct = hasValidWeights ? (latencyWeight / weightSum) * 100 : 0;

  const formatShare = (share: number): string => {
    const rounded = Number(share.toFixed(1));
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  return (
    <section className="surface-card sla-controls-card" aria-label="Multi-objective SLA policy controls">
      <div className="panel-header-row">
        <div className="panel-heading-group">
          <Sliders size={14} className="text-secondary" />
          <h2 className="panel-title">Routing Policy</h2>
        </div>
      </div>

      {/* Segmented Presets with Spring Sliding Pill */}
      <div
        className="preset-segmented"
        role="tablist"
        aria-label="Routing policy presets"
        style={
          {
            '--active-idx': Math.max(
              0,
              PRESET_OPTIONS.findIndex((opt) => opt.key === activePreset),
            ),
          } as SegmentedControlStyle
        }
      >
        <span className="preset-sliding-pill" aria-hidden="true" />
        {PRESET_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activePreset === key}
            className={`preset-tab ${activePreset === key ? 'active' : ''}`}
            onClick={() => (key === 'custom' ? setActivePreset('custom') : applyPreset(key))}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Precision Hairline Sliders */}
      <div className="hairline-sliders-stack">
        <HairlineSlider
          id={latencySliderId}
          name="max_latency_ms"
          label="Latency SLA"
          readout={`${maxLatency} ms`}
          min={50}
          max={500}
          step={10}
          value={maxLatency}
          fillTone="default"
          onChange={setMaxLatency}
        />

        <HairlineSlider
          id={carbonSliderId}
          name="carbon_priority_weight"
          label="Carbon Weight"
          readout={`${carbonWeight}%`}
          min={0}
          max={100}
          step={5}
          value={carbonWeight}
          fillTone="mint"
          onChange={(v) => handleCustomChange(setCarbonWeight, v)}
        />

        <HairlineSlider
          id={costSliderId}
          name="cost_priority_weight"
          label="Cost Weight"
          readout={`${costWeight}%`}
          min={0}
          max={100}
          step={5}
          value={costWeight}
          fillTone="slate"
          onChange={(v) => handleCustomChange(setCostWeight, v)}
        />

        <HairlineSlider
          id={latencyWeightSliderId}
          name="latency_priority_weight"
          label="Latency Weight"
          readout={`${latencyWeight}%`}
          min={0}
          max={100}
          step={5}
          value={latencyWeight}
          fillTone="sky"
          onChange={(v) => handleCustomChange(setLatencyWeight, v)}
        />
      </div>

      {/* Normalized Simplex Ratio Bar */}
      <div className="simplex-summary-block">
        <div className="simplex-bar-track" aria-label="Normalized simplex objective weights">
          {hasValidWeights ? (
            <>
              <div
                className="simplex-seg seg-mint"
                style={{ width: `${normCarbonPct}%` }}
              />
              <div
                className="simplex-seg seg-slate"
                style={{ width: `${normCostPct}%` }}
              />
              <div
                className="simplex-seg seg-sky"
                style={{ width: `${normLatencyPct}%` }}
              />
            </>
          ) : (
            <div className="simplex-seg seg-invalid" style={{ width: '100%' }} />
          )}
        </div>

        <div className="simplex-legend-row mono-tabular">
          {hasValidWeights ? (
            <>
              <span className="legend-item">
                <span className="legend-dot dot-mint" aria-hidden="true" />
                {formatShare(normCarbonPct)}% C
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-slate" aria-hidden="true" />
                {formatShare(normCostPct)}% P
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-sky" aria-hidden="true" />
                {formatShare(normLatencyPct)}% L
              </span>
            </>
          ) : (
            <span className="accent-coral">Set at least one priority weight above 0%</span>
          )}
        </div>
      </div>
    </section>
  );
});
