import { useState, useEffect } from 'react'

// --- Design tokens (Premium Grid Aesthetic, NO BLACK) ---
const bgDark = '#0F172A' 
const panelBg = 'rgba(255, 255, 255, 0.04)'
const panelBorder = 'rgba(255, 255, 255, 0.1)'
const textPrimary = '#F8FAFC'
const textSecondary = '#94A3B8'
const accent = '#10B981' // glowing emerald
const carbonColors = { zero: '#10B981', low: '#34D399', mid: '#FBBF24', high: '#F43F5E' }

const fontDisplay = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const fontMono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

function LogoMark({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
      <rect width="48" height="48" rx="14" fill="url(#glass-grad)" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      <path d="M30 18C28.2 15.6 24.8 14 20 14C14 14 14 20 14 24C14 28 14 34 20 34C24.8 34 28.2 32.4 30 30" stroke="url(#accent-grad)" strokeWidth="3" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.5))' }} />
      <path d="M21 24H35" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 20L35 24L31 28" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="24" r="2.5" fill="#10B981" style={{ filter: 'drop-shadow(0 0 6px #10B981)' }} />
      <defs>
        <linearGradient id="glass-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.2)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <linearGradient id="accent-grad" x1="14" y1="14" x2="30" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#34D399" />
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
      {/* Background with Grid and Ambient Lights */}
      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>

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
            network active
          </div>
        </header>

        {/* --- Input --- */}
        <div className={`${panelClass} input-panel fade-in`} style={{ animationDelay: '0.1s' }}>
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
              {loading ? 'Routing...' : 'Execute'}
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
            <div className="empty-icon">⌘</div>
            <p>System ready. Awaiting inference workload.</p>
          </div>
        )}

        {/* --- Error --- */}
        {isError && (
          <div className={`${panelClass} error-panel fade-in-up`}>
            <div className="error-header">
              <span className="error-icon">⚠️</span>
              <p className="error-label">Routing Exception</p>
            </div>
            <p className="error-message">{result.data}</p>
          </div>
        )}

        {/* --- Telemetry --- */}
        {result && !isError && (
          <div className="results-container">
            <div className={`${panelClass} stats-grid fade-in-up`} style={{ animationDelay: '0.1s' }}>
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
                <div className="stat-value" style={{ textShadow: `0 0 16px ${carbonColor}40` }}>
                  {carbonValue} <span className="stat-unit">gCO2e/kWh</span>
                </div>
                <div className="gauge-container">
                  <div className="gauge-fill" style={{ width: `${gaugeWidth}%`, background: carbonColor, boxShadow: `0 0 12px ${carbonColor}` }} />
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
                <div className="stat-subtext" style={{ marginTop: '33px', color: isCache ? accent : textPrimary }}>
                  {isCache ? 'Local edge execution' : 'Global cloud roundtrip'}
                </div>
              </div>
            </div>

            {/* --- Output --- */}
            <div className={`${panelClass} output-panel fade-in-up`} style={{ animationDelay: '0.2s' }}>
              <p className="stat-label">inference output</p>
              <div className="output-content">
                <span className="prompt-chevron">{'> '}</span>{result.data}
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

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

        /* Ambient Gradient Background - NEVER BLACK */
        .bg-gradient {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(circle at 15% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
                      radial-gradient(circle at 85% 100%, rgba(16, 185, 129, 0.12) 0%, transparent 50%);
        }

        /* Beautiful Subtle Grid */
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 80%);
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 80%);
        }

        /* Layout */
        .app-container { position: relative; width: 100%; min-height: 100vh; overflow-x: hidden; }
        .main-content { max-width: 860px; margin: 0 auto; padding: 60px 24px 100px; position: relative; z-index: 1; }

        /* Typography */
        h1 { 
          font-size: 42px; 
          font-weight: 700; 
          margin: 0; 
          letter-spacing: -1.5px; 
          color: #ffffff;
          line-height: 1;
        }
        
        h2 { 
          font-family: ${fontDisplay}; 
          font-size: 11px; 
          font-weight: 600; 
          color: #94A3B8; 
          margin: 8px 0 0 2px; 
          text-transform: uppercase; 
          letter-spacing: 4px; 
        }

        .prompt-chevron { font-family: ${fontMono}; color: var(--accent); font-size: 20px; user-select: none; }
        .stat-label { font-family: ${fontMono}; font-size: 12px; color: var(--text-2); margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .stat-value { font-size: 32px; font-weight: 700; letter-spacing: -1px; }
        .stat-unit { font-size: 15px; font-weight: 500; color: var(--text-2); letter-spacing: 0; }
        .stat-subtext { font-family: ${fontMono}; font-size: 12px; margin-top: 10px; }

        /* Header */
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 56px; gap: 16px; flex-wrap: wrap; }
        .header-brand { display: flex; align-items: center; gap: 20px; }
        .logo-svg { filter: drop-shadow(0 12px 24px rgba(0,0,0,0.2)); transition: transform 0.3s ease; }
        .logo-svg:hover { transform: scale(1.05); }
        .header-status { 
          display: flex; align-items: center; gap: 10px; font-family: ${fontMono}; 
          font-size: 12px; font-weight: 600; color: var(--accent); 
          background: rgba(16, 185, 129, 0.1); padding: 8px 16px; border-radius: 20px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
          box-shadow: 0 0 12px var(--accent); animation: pulse 2s infinite;
        }

        /* Glassmorphic Panels */
        .premium-panel {
          background: var(--panel);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05);
          overflow: hidden;
        }

        /* Input */
        .input-panel { padding: 12px 12px 24px; margin-bottom: 48px; }
        .input-form { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
        .prompt-input {
          flex: 1; padding: 12px; font-size: 18px; font-family: ${fontMono};
          background: transparent; border: none; color: var(--text-1); outline: none;
        }
        .prompt-input::placeholder { color: #64748B; }
        
        .run-button {
          padding: 16px 32px; background: linear-gradient(135deg, #10B981, #059669);
          color: #fff; border: none;
          border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600;
          font-family: ${fontDisplay}; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .run-button:hover:not(:disabled) {
          box-shadow: 0 6px 24px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }
        .run-button.loading { cursor: wait; opacity: 0.8; }

        /* SLA Sliders */
        .sla-controls { padding: 16px 28px 8px; display: flex; gap: 48px; flex-wrap: wrap; }
        .sla-control { flex: 1; min-width: 240px; }
        .sla-control label {
          font-family: ${fontMono}; font-size: 12px; color: var(--text-2); font-weight: 500;
          display: flex; justify-content: space-between; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .value-highlight { color: var(--text-1); font-weight: 600; }
        
        /* Custom Premium Range Slider */
        .styled-slider {
          -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px;
          background: rgba(255, 255, 255, 0.08); outline: none; margin: 0;
        }
        .styled-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: #fff; cursor: pointer;
          box-shadow: 0 0 16px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0,0,0,0.2);
          border: 2px solid var(--accent);
          transition: transform 0.1s;
        }
        .styled-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }

        /* Stats Grid */
        .stats-grid { display: flex; flex-wrap: wrap; margin-bottom: 32px; background: rgba(255,255,255,0.02); }
        .stat-card { flex: 1 1 200px; padding: 32px; border-right: 1px solid var(--border); }
        .stat-card:last-child { border-right: none; }
        
        .gauge-container { height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; margin-top: 16px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3); }
        .gauge-fill { height: 100%; border-radius: 4px; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Output */
        .output-panel { padding: 36px; border-left: 0; background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); margin-bottom: 32px; position: relative; }
        .output-panel::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(to bottom, var(--accent), #3B82F6); border-radius: 20px 0 0 20px; }
        .output-content { font-family: ${fontMono}; font-size: 16px; line-height: 1.8; white-space: pre-wrap; color: #F1F5F9; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }

        /* Impact */
        .impact-panel { padding: 36px; margin-bottom: 32px; }
        .impact-grid { display: flex; gap: 40px; flex-wrap: wrap; }
        .impact-grid > div { flex: 1; }
        .impact-value { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .impact-label { font-family: ${fontMono}; font-size: 12px; color: var(--text-2); font-weight: 500; }

        /* Table */
        .candidates-panel { margin-bottom: 32px; }
        .candidates-header { padding: 28px 32px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .candidates-header .stat-label { margin: 0; }
        .table-container { overflow-x: auto; }
        .candidates-table { width: 100%; border-collapse: collapse; font-family: ${fontMono}; font-size: 14px; text-align: left; }
        .candidates-table th { padding: 20px 32px; font-weight: 600; color: var(--text-2); background: rgba(0,0,0,0.1); border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        .candidates-table td { padding: 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .candidates-table span { color: var(--text-2); margin-left: 12px; font-size: 12px; opacity: 0.7; }
        .row-selected { background: linear-gradient(90deg, rgba(16, 185, 129, 0.08), transparent); }
        .row-selected td { border-bottom: none; }
        .status-selected { color: var(--accent); font-weight: 600; text-shadow: 0 0 12px rgba(16,185,129,0.5); }
        .status-excluded { color: #F43F5E; font-weight: 500; }
        .status-eligible { color: var(--text-2); }

        /* Empty & Error States */
        .empty-state { text-align: center; padding: 80px 0; font-family: ${fontMono}; color: var(--text-2); font-size: 15px; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.2; }
        
        .error-panel { padding: 32px; border: 1px solid rgba(244, 63, 94, 0.2); background: rgba(244, 63, 94, 0.05); }
        .error-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .error-icon { font-size: 20px; }
        .error-label { font-family: ${fontMono}; font-size: 14px; color: #F43F5E; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .error-message { font-family: ${fontMono}; font-size: 16px; margin: 0; color: #FDA4AF; }

        /* Animations */
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .fade-in { opacity: 0; animation: fadeIn 0.8s ease-out forwards; }
        .fade-in-up { opacity: 0; animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 640px) {
          .stats-grid { flex-direction: column; }
          .stat-card { border-right: none; border-bottom: 1px solid var(--border); }
          .sla-controls { flex-direction: column; gap: 24px; padding: 16px 20px; }
          .impact-grid { flex-direction: column; gap: 24px; }
        }
      `}</style>
    </div>
  )
}

export default App
