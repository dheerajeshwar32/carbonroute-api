import { useState, useEffect } from 'react'

// --- Design tokens (Premium Dark Mode) ---
const bgDark = '#090A0B'
const panelBg = 'rgba(255, 255, 255, 0.03)'
const panelBorder = 'rgba(255, 255, 255, 0.08)'
const textPrimary = '#F3F4F6'
const textSecondary = '#9CA3AF'
const accent = '#10B981' // glowing emerald
const carbonColors = { zero: '#10B981', low: '#34D399', mid: '#FBBF24', high: '#F43F5E' }

const fontDisplay = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const fontMono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

function LogoMark({ size = 42 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="40" height="40" rx="12" fill="url(#logo-grad)" stroke={panelBorder} strokeWidth="1" />
      <circle cx="12" cy="12" r="3" fill={textPrimary} />
      <circle cx="28" cy="12" r="3" fill={textPrimary} />
      <path d="M12 15 C12 23, 17 24, 20 27" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M28 15 C28 23, 23 24, 20 27" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="30" r="4" fill={accent} style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))' }} />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.08)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.01)" />
        </linearGradient>
      </defs>
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

  const panelClass = "premium-panel"

  return (
    <div className="app-container">
      {/* Animated gradient mesh background */}
      <div className="bg-mesh"></div>

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
            grid live
          </div>
        </header>

        {/* --- Input --- */}
        <div className={`${panelClass} input-panel fade-in`}>
          <form onSubmit={handleRouteRequest} className="input-form">
            <span className="prompt-chevron">{'>'}</span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to route..."
              className="prompt-input"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`run-button ${loading ? 'loading' : ''}`}
            >
              {loading ? 'Routing...' : 'Run'}
            </button>
          </form>
          
          <div className="sla-controls">
            <div className="sla-control">
              <label>
                <span>Max Latency</span>
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
          <p className="empty-state fade-in">
            Awaiting prompt...
          </p>
        )}

        {/* --- Error --- */}
        {isError && (
          <div className={`${panelClass} error-panel fade-in-up`}>
            <p className="error-label">error</p>
            <p className="error-message">{result.data}</p>
          </div>
        )}

        {/* --- Telemetry --- */}
        {result && !isError && (
          <div className="results-container">
            <div className={`${panelClass} stats-grid fade-in-up`} style={{ animationDelay: '0.1s' }}>
              {/* Region */}
              <div className="stat-card">
                <p className="stat-label">routed region</p>
                <div className="stat-value">{result.location || 'Unknown'}</div>
                <div className="stat-subtext" style={{ color: isCache ? accent : textSecondary }}>
                  {result.routed_to}
                </div>
              </div>

              {/* Carbon */}
              <div className="stat-card">
                <p className="stat-label">carbon intensity</p>
                <div className="stat-value" style={{ textShadow: `0 0 16px ${carbonColor}40` }}>
                  {carbonValue} <span className="stat-unit">gCO2e/kWh</span>
                </div>
                <div className="gauge-container">
                  <div className="gauge-fill" style={{ width: `${gaugeWidth}%`, background: carbonColor, boxShadow: `0 0 8px ${carbonColor}` }} />
                </div>
                <div className="stat-subtext" style={{ color: carbonColor }}>
                  {isCache ? 'zero-emission cache' : 'live grid draw'}
                </div>
              </div>

              {/* Latency */}
              <div className="stat-card">
                <p className="stat-label">latency</p>
                <div className="stat-value">
                  {result.telemetry?.latency_ms || 0} <span className="stat-unit">ms</span>
                </div>
                <div className="stat-subtext" style={{ marginTop: '33px', color: isCache ? accent : textSecondary }}>
                  {isCache ? 'local edge execution' : 'cloud roundtrip'}
                </div>
              </div>
            </div>

            {/* --- Output --- */}
            <div className={`${panelClass} output-panel fade-in-up`} style={{ animationDelay: '0.2s' }}>
              <p className="stat-label">output</p>
              <div className="output-content">
                <span className="prompt-chevron">{'> '}</span>{result.data}
              </div>
            </div>

            {/* --- Impact Metrics --- */}
            {result.impact && (
              <div className={`${panelClass} impact-panel fade-in-up`} style={{ animationDelay: '0.3s' }}>
                <p className="stat-label">environmental impact (estimated)</p>
                <div className="impact-grid">
                  <div>
                    <div className="impact-value">{result.impact.estimated_emissions_avoided_g}g</div>
                    <div className="impact-label">CO2 avoided vs baseline</div>
                  </div>
                  <div>
                    <div className="impact-value" style={{ color: result.impact.carbon_saved_pct > 0 ? accent : textPrimary }}>
                      {result.impact.carbon_saved_pct}%
                    </div>
                    <div className="impact-label">carbon reduction</div>
                  </div>
                  <div>
                    <div className="impact-value">{result.impact.estimated_emissions_g}g</div>
                    <div className="impact-label">total emissions</div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Routing Candidates --- */}
            {result.routing?.candidates && (
              <div className={`${panelClass} candidates-panel fade-in-up`} style={{ animationDelay: '0.4s' }}>
                <p className="stat-label" style={{ padding: '24px 24px 12px', margin: 0 }}>routing candidates</p>
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
                              {isSelected ? <span className="status-selected">Selected</span> :
                               isExcluded ? <span className="status-excluded">Excluded</span> :
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

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

        /* Ambient Glow Background */
        .bg-mesh {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: 
            radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.05), transparent 30%),
            radial-gradient(circle at 85% 30%, rgba(244, 63, 94, 0.03), transparent 30%);
        }

        /* Layout */
        .app-container { position: relative; width: 100%; min-height: 100vh; overflow-x: hidden; }
        .main-content { max-width: 820px; margin: 0 auto; padding: 60px 24px 100px; position: relative; z-index: 1; }

        /* Typography */
        h1 { font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px; }
        h2 { font-family: ${fontMono}; font-size: 13px; font-weight: 400; color: var(--text-2); margin: 4px 0 0; }
        .prompt-chevron { font-family: ${fontMono}; color: var(--accent); font-size: 18px; user-select: none; }
        .stat-label { font-family: ${fontMono}; font-size: 12px; color: var(--text-2); margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
        .stat-unit { font-size: 14px; font-weight: 500; color: var(--text-2); }
        .stat-subtext { font-family: ${fontMono}; font-size: 12.5px; margin-top: 8px; }

        /* Header */
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 48px; gap: 16px; flex-wrap: wrap; }
        .header-brand { display: flex; align-items: center; gap: 16px; }
        .header-status { display: flex; align-items: center; gap: 8px; font-family: ${fontMono}; font-size: 12px; color: var(--text-2); }
        
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
          box-shadow: 0 0 10px var(--accent); animation: pulse 2s infinite;
        }

        /* Glassmorphic Panels */
        .premium-panel {
          background: var(--panel);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }

        /* Input */
        .input-panel { padding: 8px 8px 20px; margin-bottom: 40px; }
        .input-form { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
        .prompt-input {
          flex: 1; padding: 12px; font-size: 17px; font-family: ${fontMono};
          background: transparent; border: none; color: var(--text-1); outline: none;
        }
        .prompt-input::placeholder { color: #4B5563; }
        
        .run-button {
          padding: 14px 28px; background: rgba(16, 185, 129, 0.1);
          color: var(--accent); border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 600;
          font-family: ${fontDisplay}; transition: all 0.2s;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.05);
        }
        .run-button:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.2);
          box-shadow: 0 0 24px rgba(16, 185, 129, 0.2);
          transform: translateY(-1px);
        }
        .run-button.loading { cursor: wait; opacity: 0.7; }

        /* SLA Sliders */
        .sla-controls { padding: 12px 24px 4px; display: flex; gap: 40px; flex-wrap: wrap; }
        .sla-control { flex: 1; min-width: 220px; }
        .sla-control label {
          font-family: ${fontMono}; font-size: 12px; color: var(--text-2);
          display: flex; justify-content: space-between; margin-bottom: 12px;
        }
        .value-highlight { color: var(--text-1); font-weight: 500; }
        
        /* Custom Premium Range Slider */
        .styled-slider {
          -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px;
          background: rgba(255, 255, 255, 0.1); outline: none; margin: 0;
        }
        .styled-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--text-1); cursor: pointer;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
          transition: transform 0.1s;
        }
        .styled-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

        /* Stats Grid */
        .stats-grid { display: flex; flex-wrap: wrap; margin-bottom: 24px; }
        .stat-card { flex: 1 1 200px; padding: 28px; border-right: 1px solid var(--border); }
        .stat-card:last-child { border-right: none; }
        
        .gauge-container { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 14px; overflow: hidden; }
        .gauge-fill { height: 100%; border-radius: 3px; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Output */
        .output-panel { padding: 32px; border-left: 4px solid var(--accent); margin-bottom: 24px; }
        .output-content { font-family: ${fontMono}; font-size: 15px; line-height: 1.7; white-space: pre-wrap; color: #E5E7EB; }

        /* Impact */
        .impact-panel { padding: 28px; margin-bottom: 24px; }
        .impact-grid { display: flex; gap: 32px; flex-wrap: wrap; }
        .impact-grid > div { flex: 1; }
        .impact-value { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .impact-label { font-family: ${fontMono}; font-size: 12px; color: var(--text-2); }

        /* Table */
        .candidates-panel { margin-bottom: 24px; }
        .table-container { overflow-x: auto; }
        .candidates-table { width: 100%; border-collapse: collapse; font-family: ${fontMono}; font-size: 13px; text-align: left; }
        .candidates-table th { padding: 16px 24px; font-weight: 500; color: var(--text-2); border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.01); }
        .candidates-table td { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .candidates-table span { color: var(--text-2); margin-left: 8px; font-size: 11px; }
        .row-selected { background: rgba(16, 185, 129, 0.05); }
        .row-selected td { border-bottom: none; }
        .status-selected { color: var(--accent); font-weight: 500; text-shadow: 0 0 8px rgba(16,185,129,0.4); }
        .status-excluded { color: #F43F5E; }
        .status-eligible { color: var(--text-2); }

        /* Empty & Error States */
        .empty-state { text-align: center; padding: 60px 0; font-family: ${fontMono}; color: var(--text-2); font-size: 14px; }
        .error-panel { padding: 28px; border-left: 4px solid #F43F5E; background: rgba(244, 63, 94, 0.05); }
        .error-label { font-family: ${fontMono}; font-size: 12px; color: #F43F5E; margin: 0 0 12px 0; text-transform: uppercase; }
        .error-message { font-family: ${fontMono}; font-size: 15px; margin: 0; }

        /* Animations */
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.9); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        
        .fade-in { animation: fadeIn 0.6s ease-out forwards; }
        .fade-in-up { opacity: 0; animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 640px) {
          .stats-grid { flex-direction: column; }
          .stat-card { border-right: none; border-bottom: 1px solid var(--border); }
          .sla-controls { flex-direction: column; gap: 20px; }
        }
      `}</style>
    </div>
  )
}

export default App
