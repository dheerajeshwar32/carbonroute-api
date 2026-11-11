import React, { memo } from 'react';

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
}) {
  const applyPreset = (preset) => {
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

  const handleCustomChange = (setter, val) => {
    setActivePreset('custom');
    setter(val);
  };

  return (
    <div className="sla-section">
      <div className="segmented-picker" role="tablist" aria-label="SLA Presets">
        <button
          type="button"
          className={`segmented-btn ${activePreset === 'eco' ? 'active' : ''}`}
          onClick={() => applyPreset('eco')}
        >
          Eco Max
        </button>
        <button
          type="button"
          className={`segmented-btn ${activePreset === 'balanced' ? 'active' : ''}`}
          onClick={() => applyPreset('balanced')}
        >
          Balanced
        </button>
        <button
          type="button"
          className={`segmented-btn ${activePreset === 'latency' ? 'active' : ''}`}
          onClick={() => applyPreset('latency')}
        >
          Low Latency
        </button>
        <button
          type="button"
          className={`segmented-btn ${activePreset === 'custom' ? 'active' : ''}`}
          onClick={() => setActivePreset('custom')}
        >
          Custom
        </button>
      </div>

      <div className="sliders-grid">
        <div className="slider-group">
          <div className="slider-label">
            <span>Latency SLA Limit</span>
            <span className="slider-val tabular-numbers">{maxLatency} ms</span>
          </div>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={maxLatency}
            onChange={(e) => setMaxLatency(Number(e.target.value))}
            className="apple-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>Carbon Priority</span>
            <span className="slider-val tabular-numbers">{carbonWeight}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={carbonWeight}
            onChange={(e) => handleCustomChange(setCarbonWeight, Number(e.target.value))}
            className="apple-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>Cost Priority</span>
            <span className="slider-val tabular-numbers">{costWeight}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={costWeight}
            onChange={(e) => handleCustomChange(setCostWeight, Number(e.target.value))}
            className="apple-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>Latency Priority</span>
            <span className="slider-val tabular-numbers">{latencyWeight}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={latencyWeight}
            onChange={(e) => handleCustomChange(setLatencyWeight, Number(e.target.value))}
            className="apple-slider"
          />
        </div>
      </div>
    </div>
  );
});
