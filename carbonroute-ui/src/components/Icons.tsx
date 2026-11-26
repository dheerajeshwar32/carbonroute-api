import { useId } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

const SQUIRCLE_PATH =
  'M 9.5 1 L 18.5 1 C 23.8 1, 27 4.2, 27 9.5 L 27 18.5 C 27 23.8, 23.8 27, 18.5 27 L 9.5 27 C 4.2 27, 1 23.8, 1 18.5 L 1 9.5 C 1 4.2, 4.2 1, 9.5 1 Z';

export function LogoMark({ size = 28, className }: IconProps) {
  const uid = useId().replace(/:/g, '');
  const bgGradId = `cr-squircle-bg-${uid}`;
  const rimGradId = `cr-squircle-rim-${uid}`;
  const hoverRimGradId = `cr-squircle-hover-rim-${uid}`;
  const optimalPathGradId = `cr-optimal-path-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgGradId} x1="0" y1="1" x2="0" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1F2A3E" />
          <stop offset="55%" stopColor="#131B2B" />
          <stop offset="100%" stopColor="#0D1320" />
        </linearGradient>
        <linearGradient id={rimGradId} x1="0" y1="1" x2="0" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.26)" />
          <stop offset="45%" stopColor="rgba(255, 255, 255, 0.08)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.03)" />
        </linearGradient>
        <linearGradient id={hoverRimGradId} x1="0" y1="1" x2="0" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.42)" />
          <stop offset="45%" stopColor="rgba(255, 255, 255, 0.14)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.04)" />
        </linearGradient>
        <linearGradient
          id={optimalPathGradId}
          x1="7.2"
          y1="0"
          x2="20.2"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="65%" stopColor="#D1FAE5" />
          <stop offset="100%" stopColor="#30D158" />
        </linearGradient>
      </defs>

      {/* Studio-Lit Hardware Superellipse Container & Specular Rim */}
      <path
        d={SQUIRCLE_PATH}
        fill={`url(#${bgGradId})`}
        stroke={`url(#${rimGradId})`}
        strokeWidth="1"
      />
      <path
        className="cr-logo-hover-rim"
        d={SQUIRCLE_PATH}
        fill="none"
        stroke={`url(#${hoverRimGradId})`}
        strokeWidth="1"
      />

      {/* Layer 1: Bypassed Higher-Carbon Path */}
      <path
        d="M 7.2 14 C 12.2 14, 13.8 19.4, 20.2 19.4"
        fill="none"
        stroke="rgba(226, 232, 240, 0.22)"
        strokeWidth="1.85"
        strokeLinecap="round"
      />

      {/* Layer 2: Bypassed Terminal Ring (zero bleed interior mask) */}
      <circle
        cx="20.2"
        cy="19.4"
        r="2.1"
        fill="#121A2A"
        stroke="rgba(226, 232, 240, 0.36)"
        strokeWidth="1.55"
      />

      {/* Layer 3: Optimal Clean Path */}
      <path
        d="M 7.2 14 C 12.2 14, 13.8 8.6, 20.2 8.6"
        fill="none"
        stroke={`url(#${optimalPathGradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      {/* Layer 4: Origin Node */}
      <circle cx="7.2" cy="14" r="2.15" fill="#F8FAFC" />

      {/* Layer 5: Optimal Green Destination Node + Optical Glass Highlight */}
      <circle cx="20.2" cy="8.6" r="2.55" fill="#30D158" />
      <circle cx="19.6" cy="7.9" r="0.65" fill="rgba(255, 255, 255, 0.45)" />
    </svg>
  );
}

export function ArrowUp({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function ArrowRight({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function Square({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function Check({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Copy({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function RefreshCw({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function Sliders({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 8h4" />
      <path d="M18 16h4" />
    </svg>
  );
}

export function Activity({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function Download({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function Trash2({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function AlertTriangle({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ChevronDown({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUp({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function X({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function Zap({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function Cpu({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  );
}

export function Leaf({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export function Command({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...strokeProps}>
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </svg>
  );
}
