import * as React from 'react';
import { Tooltip as T } from 'radix-ui';
import { cn } from '../../lib/utils';

export const TooltipProvider = T.Provider;
export const TooltipRoot = T.Root;
export const TooltipTrigger = T.Trigger;
export const TooltipPortal = T.Portal;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof T.Content>) {
  return (
    <T.Portal>
      <T.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md bg-ink px-2.5 py-1 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95',
          className
        )}
        {...props}
      />
    </T.Portal>
  );
}

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-white shadow-pop"
          >
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
