import type { CandidateEvaluation } from '../types/contract';

export interface CandidatesTableProps {
  candidates?: CandidateEvaluation[] | null;
  maxLatency: number;
}

export function CandidatesTable({ candidates, maxLatency }: CandidatesTableProps) {
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="glass-panel candidates-card spring-enter">
      <div className="drawer-title" style={{ marginBottom: '6px' }}>
        Routing Candidates Evaluated
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        Multi-objective optimization scoring across active cloud zones
      </div>

      <div className="table-responsive">
        <table className="matrix-table">
          <caption className="visually-hidden">
            Multi-objective routing evaluation comparing latency, carbon intensity, composite score, and status per cloud region
          </caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Roundtrip Latency</th>
              <th scope="col">Carbon Intensity</th>
              <th scope="col">Score</th>
              <th scope="col">Dispatch Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const isSelected = c.status === 'selected';
              const isExcluded = c.status === 'excluded';
              const isLatencyViolated = c.latency_ms > maxLatency;

              return (
                <tr key={c.id} className={isSelected ? 'selected-row' : ''}>
                  <th scope="row" style={{ fontWeight: 400, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.location}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{c.id}</div>
                  </th>

                  <td className="tabular-numbers">
                    <span style={{ color: isLatencyViolated ? 'var(--accent-red)' : 'inherit' }}>
                      {c.latency_ms} ms
                    </span>
                  </td>

                  <td className="tabular-numbers">
                    <span
                      style={{
                        color: c.carbon_intensity < 150
                          ? 'var(--accent-green)'
                          : c.carbon_intensity < 300
                          ? 'var(--accent-amber)'
                          : 'var(--accent-red)',
                      }}
                    >
                      {c.carbon_intensity} gCO₂e/kWh
                    </span>
                  </td>

                  <td className="tabular-numbers">
                    {typeof c.score === 'number' ? c.score.toFixed(4) : '—'}
                  </td>

                  <td>
                    {isSelected ? (
                      <span className="status-tag selected">Selected Node</span>
                    ) : isExcluded ? (
                      <span className="status-tag excluded" title={c.excluded_reason || 'SLA Exceeded'}>
                        SLA Exceeded
                      </span>
                    ) : (
                      <span className="status-tag eligible">Eligible (Rank #{c.rank})</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
