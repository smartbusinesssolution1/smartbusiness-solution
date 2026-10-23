import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: React.ComponentProps<typeof D.Content> & { hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.25rem] border border-line bg-panel shadow-pop outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <D.Close className="absolute top-4 right-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({ title, description, icon }: { title: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-6 pt-6 pb-2 pr-12">
      {icon && <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle text-ink-soft [&_svg]:size-4">{icon}</div>}
      <div className="flex flex-col gap-1">
        <D.Title className="text-[1.0625rem] font-semibold tracking-tight text-ink">{title}</D.Title>
        {description ? (
          <D.Description className="text-sm leading-relaxed text-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
        )}
      </div>
    </div>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 overflow-y-auto px-6 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 border-t border-line bg-subtle/60 px-6 py-4 sm:flex-row sm:justify-end", className)} {...props} />;
}
