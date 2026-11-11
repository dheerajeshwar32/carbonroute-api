import React, { useState } from 'react';

export function CopyRequestIdBadge({ requestId }) {
  const [copied, setCopied] = useState(false);

  if (!requestId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`copy-id-btn tabular-numbers ${copied ? 'copied' : ''}`}
      title="Click to copy request trace ID"
    >
      <span>{copied ? '✓ Copied' : `Trace ID: ${requestId.slice(0, 8)}...`}</span>
      <span style={{ fontSize: '11px', opacity: 0.7 }}>📋</span>
    </button>
  );
}
