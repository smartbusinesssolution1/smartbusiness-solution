import React from 'react';
import { cn } from '../lib/utils';

export interface BrandLoaderProps {
  /** If true (default), solid full-page background; if false, frosted backdrop blur overlay centered on screen */
  fullScreen?: boolean;
  /** Custom descriptive message displayed below the progress bar */
  message?: string;
  /** If true (default), displays a subtle shimmer progress bar at the very top of the window */
  showTopBar?: boolean;
  className?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  fullScreen = true,
  message = 'Loading workspace...',
  showTopBar = true,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 transition-colors duration-200 select-none',
        fullScreen
          ? 'bg-canvas text-ink'
          : 'bg-canvas/85 backdrop-blur-md text-ink',
        className
      )}
    >
      {/* Top slim animated gradient shimmer bar */}
      {showTopBar && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-[100000] overflow-hidden bg-transparent">
          <div className="h-full w-full bg-gradient-to-r from-primary-600 via-primary-300 to-primary-600 dark:from-primary-500 dark:via-primary-300 dark:to-primary-500 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Center Brand Icon with Soft Pulse */}
      <div className="flex size-16 items-center justify-center rounded-2xl border border-line bg-panel p-2.5 shadow-pop animate-[pulse_2.2s_ease-in-out_infinite] mb-4">
        <img
          src="/favicon.png"
          alt="SmartBusiness Clock-In"
          className="size-10 object-contain rounded-xl"
        />
      </div>

      {/* Sleek Slim Linear Progress Bar */}
      <div className="relative h-1.5 w-36 overflow-hidden rounded-full border border-line bg-subtle mb-3">
        <div className="absolute top-0 bottom-0 left-0 w-[45%] rounded-full bg-primary-600 dark:bg-primary-500 animate-[brandSlideProgress_1.4s_ease-in-out_infinite]" />
      </div>

      {/* Modern Microcopy */}
      <p className="font-mono text-xs font-medium text-muted tracking-wide text-center">
        {message}
      </p>
    </div>
  );
};

export default BrandLoader;
