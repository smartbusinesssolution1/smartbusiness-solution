import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface ClockInLogoProps {
  size?: number;
  className?: string;
  withContainer?: boolean;
}

/**
 * Official Clock In Clock Out brand icon (circular sync / cycle arrows).
 * Matches the flagship SmartBusiness product mark.
 */
export const ClockInLogo: React.FC<ClockInLogoProps> = ({
  size = 18,
  className = '',
  withContainer = false,
}) => {
  if (withContainer) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-primary-50 border border-primary-200/80 shadow-2xs p-2 shrink-0 ${className}`}
      >
        <RefreshCw
          className="text-primary-600 stroke-[2.5]"
          style={{ width: size, height: size }}
        />
      </div>
    );
  }

  return (
    <RefreshCw
      className={`text-primary-600 stroke-[2.4] shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
