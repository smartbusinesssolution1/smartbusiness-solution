import React from 'react';
import { ShieldAlert, Bell, Command, ChevronRight } from 'lucide-react';
import { Badge } from '../common/Badge';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';

export interface TopHeaderProps {
  onOpenLogs?: () => void;
  errorCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenLogs, errorCount = 3 }) => {
  return (
    <header className="h-14 border-b border-line bg-panel/95 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 select-none">
      {/* Breadcrumb Path */}
      <div className="flex items-center gap-2.5 text-xs">
        <SmartBusinessLogo size="xs" iconOnly />
        <span className="text-muted font-medium">SmartBusiness Solutions</span>
        <ChevronRight className="size-3 text-faint" />
        <span className="text-ink font-semibold">Super Admin Control</span>
        <Badge variant="blue" size="xs" className="ml-1.5">
          USA-EAST-1
        </Badge>
      </div>

      {/* Global Command Bar Trigger */}
      <div className="hidden md:flex items-center">
        <button
          onClick={() => alert('Global ⌘K search: search tenants, user accounts, checks, and trace IDs.')}
          className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-control)] bg-subtle hover:bg-line border border-line text-xs text-muted hover:text-ink transition-all cursor-pointer w-72"
        >
          <Command className="size-3.5 text-faint" />
          <span className="flex-1 text-left">Quick command search...</span>
          <kbd className="text-[10px] bg-panel border border-line px-1.5 py-0.5 rounded font-mono font-bold text-muted shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-control)] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
          >
            <ShieldAlert className="size-3.5 text-rose-600" />
            <span>
              Exceptions: <strong className="font-mono">{errorCount}</strong>
            </span>
          </button>
        )}

        <button className="relative size-8 rounded-lg border border-line bg-panel hover:bg-subtle text-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-2 bg-primary-600 rounded-full ring-2 ring-white" />
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-line text-xs font-mono text-muted">
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span className="size-1 rounded-full bg-line-strong" />
          <span className="text-ink-soft font-semibold">EST</span>
        </div>
      </div>
    </header>
  );
};
