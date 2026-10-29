import React, { useId } from 'react';

// The Check Printing product mark (a white printer with a printed sheet on a blue tile).
// Used wherever the portal shows Check Printing as a product; the SmartBusiness company
// logo (SmartBusinessLogo) stays the portal's own brand. The same drawing is Check
// Printing's BrandMark and favicon (apps/check-printing-frontend): change them together.
export const CheckPrintingLogo: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  const id = useId();
  const tile = `url(#${id}-tile)`;
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
          <stop offset="0" stopColor="#62a8f2" />
          <stop offset="1" stopColor="#2156e8" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={tile} />
      <rect width="64" height="32" rx="15" fill={`url(#${id}-shine)`} />
      {/* Paper tray, printer body, status light */}
      <rect x="21" y="12.5" width="22" height="13" rx="3.5" fill="none" stroke="#fff" strokeWidth="4" />
      <rect x="11" y="23" width="42" height="20" rx="5.5" fill="#fff" />
      <circle cx="46" cy="29.5" r="2.3" fill={tile} />
      {/* The printed sheet, set off from the body by a tile-coloured gap, with two lines */}
      <rect x="19" y="35" width="26" height="17.5" rx="3" fill="#fff" stroke={tile} strokeWidth="3" />
      <path d="M24.5 41.5h15M24.5 46.5h15" stroke={tile} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
};
