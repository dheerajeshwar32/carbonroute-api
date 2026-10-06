import { useState, useEffect } from 'react'

// --- Design tokens (Premium Minimalist, No Black, No Flashy Gradients) ---
// Using Apple-like premium dark mode colors (deep muted gray/slate)
const bgDark = '#1C1C1E' 
const panelBg = 'rgba(255, 255, 255, 0.03)'
const panelBorder = 'rgba(255, 255, 255, 0.06)'
const textPrimary = '#F5F5F7' // Apple standard off-white
const textSecondary = '#86868B'
const accent = '#10B981' 
const carbonColors = { zero: '#10B981', low: '#34D399', mid: '#FBBF24', high: '#F43F5E' }

const fontDisplay = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif'
const fontMono = '"SF Mono", "Roboto Mono", Menlo, monospace'

function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      <path d="M30 18C28.2 15.6 24.8 14 20 14C14 14 14 20 14 24C14 28 14 34 20 34C24.8 34 28.2 32.4 30 30" stroke={textPrimary} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M21 24H35" stroke={textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 20L35 24L31 28" stroke={textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="24" r="2.5" fill={accent} />
    </svg>
  )
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [gaugeWidth, setGaugeWidth] = useState(0)
  
  const [maxLatency, setMaxLatency] = useState(200)
  const [carbonWeight, setCarbonWeight] = useState(90)
  const costWeight = 100 - carbonWeight

  const API_URL = import.meta.env.VITE_API_BASE_URL || "https://carbonroute-ipqv.onrender.com/api/v1/inference";

  const handleRouteRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setGaugeWidth(0)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          model: "gemini-3.5-flash",
          sla: { max_latency_ms: maxLatency, carbon_priority_weight: carbonWeight / 100, cost_priority_weight: costWeight / 100 }
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setResult({ data: `Error: ${data.error || response.statusText}`, telemetry: {} })
      } else {
        setResult(data)
      }
    } catch (error) {
      console.error("Routing failed:", error)
      setResult({ data: "Error: ensure your backend is live.", telemetry: {} })
    } finally {
      setLoading(false)
    }
  }

  const isError = typeof result?.data === 'string' && result.data.startsWith('Error')
  const carbonValue = result?.telemetry?.live_carbon_intensity ?? 0
  const isCache = !isError && result && carbonValue === 0
  const carbonPct = Math.min(100, Math.round((carbonValue / 500) * 100))
  const carbonLevel = isCache ? 'zero' : carbonValue < 150 ? 'low' : carbonValue < 300 ? 'mid' : 'high'
  const carbonColor = carbonColors[carbonLevel]

  useEffect(() => {
    if (result && !isError) {
      const t = setTimeout(() => setGaugeWidth(carbonPct), 100)
      return () => clearTimeout(t)
    }
  }, [result, isError, carbonPct])

  const panelClass = "minimal-panel"

  return (
    <div className="app-container">
      {/* Clean elegant background, no fancy grids or glowing meshes */}
      
      <div className="main-content">
        {/* --- Header --- */}
        <header className="header fade-in">
          <div className="header-brand">
            <LogoMark />
            <div className="header-titles">
              <h1>CarbonRoute</h1>
              <h2>sustainable inference routing</h2>
            </div>
          </div>
          <div className="header-status">
            <span className="live-dot" />
            <span className="status-text">Network Active</span>
          </div>
        </header>

        {/* --- Input --- */}
        <div className={`${panelClass} input-panel fade-in`} style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleRouteRequest} className="input-form">
            <span className="prompt-chevron">/</span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter inference prompt..."
              className="prompt-input"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`run-button ${loading ? 'loading' : ''}`}
            >
              {loading ? 'Routing' : 'Execute'}
            </button>
          </form>
          
          <div className="sla-controls">
            <div className="sla-control">
              <label>
                <span>Max Latency Limit</span>
                <span className="value-highlight">{maxLatency} ms</span>
              </label>
              <input type="range" min="50" max="500" step="10" value={maxLatency} onChange={e => setMaxLatency(Number(e.target.value))} className="styled-slider" />
            </div>
            <div className="sla-control">
              <label>
                <span>Priority: Cost &lt; Carbon</span>
                <span className="value-highlight">{costWeight}% / {carbonWeight}%</span>
              </label>
              <input type="range" min="0" max="100" step="10" value={carbonWeight} onChange={e => setCarbonWeight(Number(e.target.value))} className="styled-slider" />
            </div>
          </div>
        </div>

        {/* --- Empty state --- */}
        {!result && !loading && (
          <div className="empty-state fade-in" style={{ animationDelay: '0.2s' }}>
            <p>System ready.</p>
          </div>
        )}

        {/* --- Error --- */}
        {isError && (
          <div className={`${panelClass} error-panel fade-in-up`}>
            <p className="error-label">Routing Exception</p>
            <p className="error-message">{result.data}</p>
          </div>
        )}

        {/* --- Telemetry --- */}
        {result && !isError && (
          <div className="results-container">
            <div className="stats-grid fade-in-up" style={{ animationDelay: '0.1s' }}>
              {/* Region */}
              <div className="stat-card">
                <p className="stat-label">routed edge</p>
                <div className="stat-value">{result.location || 'Unknown'}</div>
                <div className="stat-subtext" style={{ color: isCache ? accent : textPrimary }}>
                  {result.routed_to}
                </div>
              </div>

              {/* Carbon */}
              <div className="stat-card">
                <p className="stat-label">grid intensity</p>
                <div className="stat-value">
                  {carbonValue} <span className="stat-unit">gCO2e/kWh</span>
                </div>
                <div className="gauge-container">
                  <div className="gauge-fill" style={{ width: `${gaugeWidth}%`, background: carbonColor }} />
                </div>
                <div className="stat-subtext" style={{ color: carbonColor }}>
                  {isCache ? 'Zero-emission execution (Cache)' : 'Live grid energy draw'}
                </div>
              </div>

              {/* Latency */}
              <div className="stat-card">
                <p className="stat-label">roundtrip latency</p>
                <div className="stat-value">
                  {result.telemetry?.latency_ms || 0} <span className="stat-unit">ms</span>
                </div>
                <div className="stat-subtext">
                  {isCache ? 'Local edge execution' : 'Global cloud roundtrip'}
                </div>
              </div>
            </div>

            {/* --- Output --- */}
            <div className={`${panelClass} output-panel fade-in-up`} style={{ animationDelay: '0.2s' }}>
              <p className="stat-label">inference output</p>
              <div className="output-content">
                {result.data}
              </div>
            </div>

            {/* --- Impact Metrics --- */}
            {result.impact && (
              <div className={`${panelClass} impact-panel fade-in-up`} style={{ animationDelay: '0.3s' }}>
                <p className="stat-label">environmental impact</p>
                <div className="impact-grid">
                  <div>
                    <div className="impact-value">{result.impact.estimated_emissions_avoided_g}g</div>
                    <div className="impact-label">CO2 avoided vs baseline</div>
                  </div>
                  <div>
                    <div className="impact-value" style={{ color: result.impact.carbon_saved_pct > 0 ? accent : textPrimary }}>
                      {result.impact.carbon_saved_pct}%
                    </div>
                    <div className="impact-label">carbon reduction achieved</div>
                  </div>
                  <div>
                    <div className="impact-value">{result.impact.estimated_emissions_g}g</div>
                    <div className="impact-label">total emissions generated</div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Routing Candidates --- */}
            {result.routing?.candidates && (
              <div className={`${panelClass} candidates-panel fade-in-up`} style={{ animationDelay: '0.4s' }}>
                <div className="candidates-header">
                  <p className="stat-label">routing candidates evaluated</p>
                </div>
                <div className="table-container">
                  <table className="candidates-table">
                    <thead>
                      <tr>
                        <th>Region</th>
                        <th>Latency</th>
                        <th>Carbon</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.routing.candidates.map((c, i) => {
                        const isSelected = c.status === 'selected'
                        const isExcluded = c.status === 'excluded'
                        return (
                          <tr key={c.id} className={isSelected ? 'row-selected' : ''}>
                            <td>{c.location} <span>{c.id}</span></td>
                            <td style={{ color: c.latency_ms > maxLatency ? carbonColors.high : textPrimary }}>{c.latency_ms} ms</td>
                            <td>{c.carbon_intensity} g</td>
                            <td>
                              {isSelected ? <span className="status-selected">Selected Node</span> :
                               isExcluded ? <span className="status-excluded">SLA Exceeded</span> :
                               <span className="status-eligible">Eligible</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        :root {
          --bg: ${bgDark};
          --panel: ${panelBg};
          --border: ${panelBorder};
          --text-1: ${textPrimary};
          --text-2: ${textSecondary};
          --accent: ${accent};
        }

        html, body, #root {
          margin: 0; padding: 0; width: 100%; min-height: 100vh;
          background-color: var(--bg);
          color: var(--text-1);
          font-family: ${fontDisplay};
          -webkit-font-smoothing: antialiased;
        }

        /* Layout */
        .app-container { position: relative; width: 100%; min-height: 100vh; overflow-x: hidden; }
        .main-content { max-width: 800px; margin: 0 auto; padding: 80px 24px 100px; position: relative; z-index: 1; }

        /* Typography */
        h1 { 
          font-size: 32px; 
          font-weight: 600; 
          margin: 0; 
          letter-spacing: -0.5px; 
          line-height: 1; 
          color: var(--text-1);
        }
        
        h2 {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-2);
          margin-top: 6px;
          letter-spacing: 0.5px;
        }

        .stat-label { font-size: 11px; color: var(--text-2); margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }
        .stat-value { font-size: 32px; font-weight: 500; letter-spacing: -0.5px; }
        .stat-unit { font-size: 15px; font-weight: 400; color: var(--text-2); letter-spacing: 0; }
        .stat-subtext { font-size: 12px; margin-top: 10px; color: var(--text-2); }

        /* Header */
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 64px; gap: 16px; flex-wrap: wrap; }
        .header-brand { display: flex; align-items: center; gap: 16px; }
        .header-status { 
          display: flex; align-items: center; gap: 8px;
        }
        .status-text { font-size: 13px; color: var(--text-2); font-weight: 500; }
        
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
        }

        /* Minimal Panels */
        .minimal-panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        /* Input */
        .input-panel { padding: 8px 8px 16px; margin-bottom: 48px; }
        .input-form { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); margin-bottom: 16px; }
        .prompt-chevron { font-family: ${fontMono}; color: var(--text-2); font-size: 16px; user-select: none; }
        .prompt-input {
          flex: 1; padding: 12px; font-size: 16px; font-family: ${fontDisplay};
          background: transparent; border: none; color: var(--text-1); outline: none;
        }
        .prompt-input::placeholder { color: #636366; font-weight: 400; }
        
        .run-button {
          padding: 10px 20px; background: rgba(255,255,255,0.1);
          color: var(--text-1); border: none;
          border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
          font-family: ${fontDisplay}; transition: background 0.2s;
        }
        .run-button:hover:not(:disabled) {
          background: rgba(255,255,255,0.15);
        }
        .run-button.loading { cursor: wait; opacity: 0.5; }

        /* SLA Sliders */
        .sla-controls { padding: 0 24px; display: flex; gap: 48px; flex-wrap: wrap; }
        .sla-control { flex: 1; min-width: 240px; }
        .sla-control label {
          font-size: 12px; color: var(--text-2); font-weight: 500;
          display: flex; justify-content: space-between; margin-bottom: 12px; 
        }
        .value-highlight { color: var(--text-1); }
        
        /* Custom Premium Range Slider */
        .styled-slider {
          -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px;
          background: rgba(255, 255, 255, 0.1); outline: none; margin: 0;
        }
        .styled-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #fff; cursor: pointer;
          transition: transform 0.1s;
        }
        .styled-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }

        /* Stats Grid */
        .stats-grid { display: flex; flex-wrap: wrap; margin-bottom: 32px; gap: 16px; }
        .stat-card { flex: 1 1 220px; padding: 24px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
        
        .gauge-container { height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 16px; overflow: hidden; }
        .gauge-fill { height: 100%; border-radius: 2px; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Output */
        .output-panel { padding: 32px; margin-bottom: 32px; }
        .output-content { font-family: ${fontMono}; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: var(--text-1); }

        /* Impact */
        .impact-panel { padding: 32px; margin-bottom: 32px; }
        .impact-grid { display: flex; gap: 40px; flex-wrap: wrap; }
        .impact-grid > div { flex: 1; }
        .impact-value { font-size: 28px; font-weight: 500; margin-bottom: 8px; }
        .impact-label { font-size: 12px; color: var(--text-2); font-weight: 400; }

        /* Table */
        .candidates-panel { margin-bottom: 32px; }
        .candidates-header { padding: 24px 32px 12px; border-bottom: 1px solid var(--border); }
        .candidates-header .stat-label { margin: 0; }
        .table-container { overflow-x: auto; }
        .candidates-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        .candidates-table th { padding: 16px 32px; font-weight: 500; color: var(--text-2); border-bottom: 1px solid var(--border); }
        .candidates-table td { padding: 16px 32px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .candidates-table span { color: var(--text-2); margin-left: 12px; font-size: 12px; }
        .row-selected { background: rgba(255,255,255,0.02); }
        .row-selected td { border-bottom: none; }
        .status-selected { color: var(--text-1); font-weight: 500; }
        .status-excluded { color: var(--text-2); }
        .status-eligible { color: var(--text-2); }

        /* Empty & Error States */
        .empty-state { text-align: center; padding: 60px 0; color: var(--text-2); font-size: 14px; }
        
        .error-panel { padding: 24px; border: 1px solid rgba(244, 63, 94, 0.3); background: transparent; }
        .error-label { font-size: 12px; color: #F43F5E; margin: 0 0 8px 0; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
        .error-message { font-size: 14px; margin: 0; color: var(--text-1); }

        /* Animations */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .fade-in { opacity: 0; animation: fadeIn 0.6s ease-out forwards; }
        .fade-in-up { opacity: 0; animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 640px) {
          .stats-grid { flex-direction: column; }
          .sla-controls { flex-direction: column; gap: 24px; padding: 0 16px; }
          .impact-grid { flex-direction: column; gap: 24px; }
        }
      `}</style>
    </div>
  )
}

export default App
