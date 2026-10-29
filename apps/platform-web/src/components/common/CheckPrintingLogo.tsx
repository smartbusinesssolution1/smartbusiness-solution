import React, { useId } from 'react';

// The Check Printing product mark on the portal: an outlined printer with a tick (Lucide
// "printer-check", ISC) in white on a dark blue tile. Used wherever the portal shows Check
// Printing as a product; the SmartBusiness company logo (SmartBusinessLogo) stays the
// portal's own brand. Check Printing itself draws the same mark in blue on a pale tile
// (apps/check-printing-frontend: BrandMark, favicon): change them together.
export const CheckPrintingLogo: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Check Printing"
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a3a8f" />
          <stop offset="1" stopColor="#0b1f4d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />
      <g
        transform="translate(16 16) scale(1.3333)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.5 22H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v.5" />
        <path d="m16 19 2 2 4-4" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" />
        <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      </g>
    </svg>
  );
};
