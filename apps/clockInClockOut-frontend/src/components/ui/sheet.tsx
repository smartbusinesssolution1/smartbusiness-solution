import * as React from 'react';
import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;
export const SheetPortal = D.Portal;

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof D.Overlay>) {
  return (
    <D.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200',
        className
      )}
      {...props}
    />
  );
}

export function SheetContent({
  className,
  children,
  side = 'right',
  hideClose = false,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  side?: 'right' | 'left';
  hideClose?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <D.Content
        className={cn(
          'fixed top-0 bottom-0 z-50 flex h-full flex-col bg-panel text-ink shadow-2xl outline-none transition-transform duration-300 ease-in-out',
          side === 'right' && 'right-0 w-full sm:max-w-xl md:max-w-2xl border-l border-line',
          side === 'left' && 'left-0 w-full sm:max-w-xl md:max-w-2xl border-r border-line',
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <D.Close
            className="absolute top-4 right-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink focus:outline-none"
            aria-label="Close"
          >
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </SheetPortal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-line bg-subtle/50 px-6 py-4', className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof D.Title>) {
  return (
    <D.Title
      className={cn('text-base font-semibold tracking-tight text-ink', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof D.Description>) {
  return (
    <D.Description
      className={cn('text-xs leading-relaxed text-muted', className)}
      {...props}
    />
  );
}

export function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-t border-line bg-subtle/40 px-6 py-3.5', className)}
      {...props}
    />
  );
}
