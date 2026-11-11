import React from 'react';

export function LogoMark({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35))' }}
    >
      <circle cx="11" cy="11" r="3.5" stroke="#F8FAFC" strokeWidth="2.2" fill="none" />
      <circle cx="29" cy="11" r="3.5" stroke="#F8FAFC" strokeWidth="2.2" fill="none" />
      <path
        d="M11 15 C11 22, 16 23, 20 26"
        stroke="#F8FAFC"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M29 15 C29 22, 24 23, 20 26"
        stroke="#F8FAFC"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="28.5" r="4" fill="#10B981" />
    </svg>
  );
}
