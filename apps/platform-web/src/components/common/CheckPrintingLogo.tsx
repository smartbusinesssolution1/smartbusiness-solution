import React from 'react';

// The Check Printing product mark on the portal: an outlined printer with a tick (Lucide
// "printer-check", ISC) in white on Check Printing's button blue (#2156e8, primary-600 in
// apps/check-printing-frontend/src/index.css). Used wherever the portal shows Check
// Printing as a product; the SmartBusiness company logo (SmartBusinessLogo, and smart.png as
// the favicon) stays the portal's own brand. Check
// Printing itself draws the same mark in blue on a pale tile (BrandMark): change them
// together.
export const CHECK_PRINTING_BLUE = '#2156e8';

export const CheckPrintingLogo: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Check Printing"
    >
      <rect width="64" height="64" rx="15" fill={CHECK_PRINTING_BLUE} />
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
