import * as React from "react";
import { DropdownMenu as M, Tooltip as T, Popover as P } from "radix-ui";
import { cn } from "@/lib/utils";

// ─── Dropdown menu ─────────────────────────────────────────

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 rounded-xl border border-line bg-panel p-1 shadow-pop data-[state=open]:animate-drop-in",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, destructive, ...props }: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted",
        destructive && "text-danger-600 data-[highlighted]:bg-danger-50 [&_svg]:text-danger-600",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2.5 pt-2 pb-1 font-mono text-[0.6875rem] tracking-wider text-faint uppercase", className)} {...props} />;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

// ─── Tooltip ───────────────────────────────────────────────

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-white shadow-pop data-[state=delayed-open]:animate-drop-in">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

// ─── Popover ───────────────────────────────────────────────

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 rounded-xl border border-line bg-panel p-1 shadow-pop outline-none data-[state=open]:animate-drop-in", className)}
        {...props}
      />
    </P.Portal>
  );
}
