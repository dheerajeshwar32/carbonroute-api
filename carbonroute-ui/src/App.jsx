import { useState, useEffect } from 'react'

// --- Design tokens -----------------------------------------------------
// Grounded in the subject: a grid/route control panel, not a generic
// SaaS card kit. Color does real work — the carbon scale (green/amber/
// red) is the only saturated color in the page, and it's tied to the
// actual live_carbon_intensity value, not decoration.
const ink = '#15211A'
const inkMuted = '#5C6B61'
const paper = '#F3F5F0'
const panel = '#FDFEFC'
const hairline = '#DCE3D8'
const accent = '#28633F'       // brand / action — used sparingly
const accentSoft = 'rgba(40, 99, 63, 0.10)'
const carbonColors = { zero: '#28633F', low: '#3E8F5D', mid: '#C08A2E', high: '#B14832' }

const fontDisplay = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const fontMono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

function LogoMark({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill={panel} stroke={hairline} />
      <circle cx="11" cy="11" r="3" stroke={ink} strokeWidth="2" fill={panel} />
      <circle cx="29" cy="11" r="3" stroke={ink} strokeWidth="2" fill={panel} />
      <path d="M11 14 C11 21, 16 22, 20 25" stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M29 14 C29 21, 24 22, 20 25" stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="28" r="3.5" fill={accent} />
    </svg>
  )
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [gaugeWidth, setGaugeWidth] = useState(0)

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
          sla: { max_latency_ms: 200, carbon_priority_weight: 0.9, cost_priority_weight: 0.1 }
        })
      })
      const data = await response.json()
      setResult(data)
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
      const t = setTimeout(() => setGaugeWidth(carbonPct), 60)
      return () => clearTimeout(t)
    }
  }, [result, isError, carbonPct])

  const panelStyle = {
    backgroundColor: panel,
    borderRadius: '10px',
    border: `1px solid ${hairline}`,
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: paper,
      color: ink,
      fontFamily: fontDisplay,
      position: 'relative',
      overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased'
    }}>

      {/* faint schematic grid — texture, not decoration */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${hairline} 1px, transparent 1px), linear-gradient(90deg, ${hairline} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
        opacity: 0.35
      }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 20px 80px', position: 'relative', zIndex: 1 }}>

        {/* --- Header --- */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <LogoMark />
            <div>
              <div style={{ fontSize: '21px', fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.2 }}>CarbonRoute</div>
              <div style={{ fontFamily: fontMono, fontSize: '12.5px', color: inkMuted, marginTop: '2px' }}>sustainable inference routing</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: fontMono, fontSize: '12px', color: inkMuted }}>
            <span className="live-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: accent, display: 'inline-block' }} />
            grid live
          </div>
        </header>

        {/* --- Input --- */}
        <div style={{ ...panelStyle, padding: '6px 6px 14px', marginBottom: '32px' }}>
          <form onSubmit={handleRouteRequest} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: fontMono, color: accent, fontSize: '17px', paddingLeft: '16px', userSelect: 'none' }}>{'>'}</span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to route"
              style={{
                flex: 1,
                padding: '16px 12px',
                fontSize: '16px',
                fontFamily: fontMono,
                backgroundColor: 'transparent',
                border: 'none',
                color: ink,
                outline: 'none'
              }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="run-button"
              style={{
                margin: '0 6px',
                padding: '13px 26px',
                background: accent,
                color: paper,
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: fontDisplay,
                opacity: loading ? 0.7 : 1
              }}>
              {loading ? 'Routing…' : 'Run'}
            </button>
          </form>
          <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '10px 0 0 20px' }}>
            policy: latency under 200ms, carbon weighted 90%, cost weighted 10%
          </p>
        </div>

        {/* --- Empty state --- */}
        {!result && !loading && (
          <p style={{ fontFamily: fontMono, fontSize: '13px', color: inkMuted, textAlign: 'center', padding: '20px 0' }}>
            No requests yet — run a prompt above to see the routing decision.
          </p>
        )}

        {/* --- Error --- */}
        {isError && (
          <div style={{ ...panelStyle, padding: '24px', borderLeft: `3px solid ${carbonColors.high}` }}>
            <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '0 0 8px 0' }}>error</p>
            <p style={{ fontFamily: fontMono, fontSize: '15px', color: ink, margin: 0 }}>{result.data}</p>
          </div>
        )}

        {/* --- Telemetry --- */}
        {result && !isError && (
          <div>
            <div style={{ ...panelStyle, display: 'flex', flexWrap: 'wrap', marginBottom: '20px' }}>

              {/* Region */}
              <div style={{ flex: '1 1 200px', padding: '22px 24px' }}>
                <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '0 0 10px 0' }}>routed region</p>
                <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px' }}>{result.location || 'Unknown'}</div>
                <div style={{ fontFamily: fontMono, fontSize: '12.5px', color: isCache ? accent : inkMuted, marginTop: '6px' }}>
                  {result.routed_to}
                </div>
              </div>

              {/* Carbon */}
              <div style={{ flex: '1 1 200px', padding: '22px 24px', borderLeft: `1px solid ${hairline}` }}>
                <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '0 0 10px 0' }}>carbon intensity</p>
                <div style={{ fontFamily: fontMono, fontSize: '24px', fontWeight: 500, color: ink }}>
                  {carbonValue} <span style={{ fontSize: '13px', color: inkMuted }}>gCO2e/kWh</span>
                </div>
                <div style={{ height: '5px', background: hairline, borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                  <div className="gauge-fill" style={{ height: '100%', width: `${gaugeWidth}%`, background: carbonColor, borderRadius: '3px' }} />
                </div>
                <div style={{ fontFamily: fontMono, fontSize: '12.5px', color: carbonColor, marginTop: '8px' }}>
                  {isCache ? 'zero-emission cache' : 'live grid draw'}
                </div>
              </div>

              {/* Latency */}
              <div style={{ flex: '1 1 200px', padding: '22px 24px', borderLeft: `1px solid ${hairline}` }}>
                <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '0 0 10px 0' }}>latency</p>
                <div style={{ fontFamily: fontMono, fontSize: '24px', fontWeight: 500 }}>
                  {result.telemetry?.latency_ms || 0} <span style={{ fontSize: '13px', color: inkMuted }}>ms</span>
                </div>
                <div style={{ fontFamily: fontMono, fontSize: '12.5px', color: isCache ? accent : inkMuted, marginTop: '31px' }}>
                  {isCache ? 'local edge execution' : 'cloud roundtrip'}
                </div>
              </div>
            </div>

            {/* --- Output --- */}
            <div style={{ ...panelStyle, padding: '28px', borderLeft: `3px solid ${accent}` }}>
              <p style={{ fontFamily: fontMono, fontSize: '11.5px', color: inkMuted, margin: '0 0 14px 0' }}>output</p>
              <div style={{ fontFamily: fontMono, color: ink, fontSize: '15px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                <span style={{ color: accent }}>{'> '}</span>{result.data}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: none !important;
          background-color: ${paper} !important;
        }

        input::placeholder { color: #9AA69C; }

        button:focus-visible, input:focus-visible {
          outline: 2px solid ${accent};
          outline-offset: 2px;
        }

        .run-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .gauge-fill {
          transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .live-dot {
          animation: pulse 2.4s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        @media (prefers-reduced-motion: reduce) {
          .gauge-fill { transition: none; }
          .live-dot { animation: none; }
        }

        @media (max-width: 480px) {
          header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  )
}

export default App