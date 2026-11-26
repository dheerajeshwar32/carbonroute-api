import { useEffect, useRef, useState } from 'react';

export interface CopyRequestIdBadgeProps {
  requestId?: string | null;
}

export function CopyRequestIdBadge({ requestId }: CopyRequestIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!requestId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`copy-id-btn tabular-numbers ${copied ? 'copied' : ''}`}
      title="Click to copy request trace ID"
      aria-label={copied ? 'Trace ID copied to clipboard' : `Copy trace ID ${requestId}`}
    >
      <span>{copied ? '✓ Copied' : `Trace ID: ${requestId.slice(0, 8)}...`}</span>
      <span aria-hidden="true" style={{ fontSize: '11px', opacity: 0.7 }}>📋</span>
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Copied request trace ID to clipboard' : ''}
      </span>
    </button>
  );
}
