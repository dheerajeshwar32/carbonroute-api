import React from 'react';

export function SkeletonLoader() {
  return (
    <div className="glass-panel skeleton-card spring-enter" aria-label="Calculating optimal route...">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="skeleton-box" style={{ width: '12px', height: '12px', borderRadius: '50%' }} />
        <div className="skeleton-box skeleton-line" style={{ width: '220px' }} />
      </div>

      <div className="skeleton-grid">
        <div className="skeleton-box skeleton-stat" />
        <div className="skeleton-box skeleton-stat" />
        <div className="skeleton-box skeleton-stat" />
      </div>

      <div className="skeleton-box" style={{ height: '80px', marginTop: '8px' }} />
    </div>
  );
}
