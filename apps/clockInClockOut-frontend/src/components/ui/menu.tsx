import * as React from 'react';
import { DropdownMenu as M, Tooltip as T, Popover as P } from 'radix-ui';
import { cn } from '../../lib/utils';

// ─── Dropdown menu ─────────────────────────────────────────

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuPortal = M.Portal;
export const MenuSub = M.Sub;
export const MenuRadioGroup = M.RadioGroup;

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 rounded-xl border border-line bg-panel p-1 text-ink shadow-pop outline-none data-[state=open]:animate-drop-in',
          className
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0',
        destructive &&
          'text-rose-600 data-[highlighted]:bg-rose-50 dark:data-[highlighted]:bg-rose-950/40 [&_svg]:text-rose-600',
        className
      )}
      {...props}
    />
  );
}

export function MenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof M.Label>) {
  return (
    <M.Label
      className={cn(
        'px-2.5 pt-2 pb-1 font-mono text-[0.6875rem] font-semibold tracking-wider text-muted uppercase',
        className
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />;
}

// ─── Tooltip ───────────────────────────────────────────────

export { Tooltip, TooltipProvider } from './tooltip';

// ─── Popover ───────────────────────────────────────────────

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-xl border border-line bg-panel p-1 shadow-pop outline-none data-[state=open]:animate-drop-in',
          className
        )}
        {...props}
      />
    </P.Portal>
  );
}

// ─── DropdownMenu Aliases (Full Backward Compatibility) ───

export const DropdownMenu = Menu;
export const DropdownMenuTrigger = MenuTrigger;
export const DropdownMenuGroup = MenuGroup;
export const DropdownMenuPortal = MenuPortal;
export const DropdownMenuSub = MenuSub;
export const DropdownMenuRadioGroup = MenuRadioGroup;
export const DropdownMenuContent = MenuContent;
export const DropdownMenuItem = MenuItem;
export const DropdownMenuLabel = MenuLabel;
export const DropdownMenuSeparator = MenuSeparator;
