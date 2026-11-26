import React, { memo, useId } from 'react';
import type { SLAPreset } from '../types/contract';

const calcPct = (val: number, min: number, max: number): number =>
  Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

type SliderCSSProperties = React.CSSProperties & {
  '--slider-pct': string;
};

export interface SLAControlsProps {
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
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  allowedModels: string[];
  disabled?: boolean;
}

export const SLAControls = memo(function SLAControls({
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
  selectedModel,
  setSelectedModel,
  allowedModels,
  disabled = false,
}: SLAControlsProps) {
  const latencySliderId = useId();
  const carbonSliderId = useId();
  const costSliderId = useId();
  const latencyWeightSliderId = useId();
  const modelSelectId = useId();

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

  const maxLatencyPct = calcPct(maxLatency, 50, 500);
  const carbonWeightPct = calcPct(carbonWeight, 0, 100);
  const costWeightPct = calcPct(costWeight, 0, 100);
  const latencyWeightPct = calcPct(latencyWeight, 0, 100);

  return (
    <div className="sla-section">
      <div className="sla-toolbar">
        <div className="segmented-picker" role="tablist" aria-label="SLA Presets">
          <button
            type="button"
            role="tab"
            aria-selected={activePreset === 'eco'}
            className={`segmented-btn ${activePreset === 'eco' ? 'active' : ''}`}
            onClick={() => applyPreset('eco')}
          >
            Eco Max
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePreset === 'balanced'}
            className={`segmented-btn ${activePreset === 'balanced' ? 'active' : ''}`}
            onClick={() => applyPreset('balanced')}
          >
            Balanced
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePreset === 'latency'}
            className={`segmented-btn ${activePreset === 'latency' ? 'active' : ''}`}
            onClick={() => applyPreset('latency')}
          >
            Low Latency
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePreset === 'custom'}
            className={`segmented-btn ${activePreset === 'custom' ? 'active' : ''}`}
            onClick={() => setActivePreset('custom')}
          >
            Custom
          </button>
        </div>

        <div className="model-selector-group">
          <label htmlFor={modelSelectId} className="model-selector-label">
            Model
          </label>
          <select
            id={modelSelectId}
            name="model"
            value={selectedModel}
            disabled={disabled || allowedModels.length === 0}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-select"
          >
            {allowedModels.length === 0 ? (
              <option value="">Awaiting gateway...</option>
            ) : (
              allowedModels.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="sliders-grid">
        <div className="slider-group">
          <label htmlFor={latencySliderId} className="slider-label">
            <span>Latency SLA Limit</span>
            <span className="slider-val tabular-numbers">{maxLatency} ms</span>
          </label>
          <input
            id={latencySliderId}
            name="max_latency_ms"
            type="range"
            min={50}
            max={500}
            step={10}
            value={maxLatency}
            onChange={(e) => setMaxLatency(Number(e.target.value))}
            className="apple-slider"
            style={{ '--slider-pct': `${maxLatencyPct}%` } as SliderCSSProperties}
          />
        </div>

        <div className="slider-group">
          <label htmlFor={carbonSliderId} className="slider-label">
            <span>Carbon Priority</span>
            <span className="slider-val tabular-numbers">{carbonWeight}%</span>
          </label>
          <input
            id={carbonSliderId}
            name="carbon_priority_weight"
            type="range"
            min={0}
            max={100}
            step={5}
            value={carbonWeight}
            onChange={(e) => handleCustomChange(setCarbonWeight, Number(e.target.value))}
            className="apple-slider"
            style={{ '--slider-pct': `${carbonWeightPct}%` } as SliderCSSProperties}
          />
        </div>

        <div className="slider-group">
          <label htmlFor={costSliderId} className="slider-label">
            <span>Cost Priority</span>
            <span className="slider-val tabular-numbers">{costWeight}%</span>
          </label>
          <input
            id={costSliderId}
            name="cost_priority_weight"
            type="range"
            min={0}
            max={100}
            step={5}
            value={costWeight}
            onChange={(e) => handleCustomChange(setCostWeight, Number(e.target.value))}
            className="apple-slider"
            style={{ '--slider-pct': `${costWeightPct}%` } as SliderCSSProperties}
          />
        </div>

        <div className="slider-group">
          <label htmlFor={latencyWeightSliderId} className="slider-label">
            <span>Latency Priority</span>
            <span className="slider-val tabular-numbers">{latencyWeight}%</span>
          </label>
          <input
            id={latencyWeightSliderId}
            name="latency_priority_weight"
            type="range"
            min={0}
            max={100}
            step={5}
            value={latencyWeight}
            onChange={(e) => handleCustomChange(setLatencyWeight, Number(e.target.value))}
            className="apple-slider"
            style={{ '--slider-pct': `${latencyWeightPct}%` } as SliderCSSProperties}
          />
        </div>
      </div>
    </div>
  );
});
