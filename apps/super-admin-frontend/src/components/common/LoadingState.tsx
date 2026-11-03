import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading data...',
  sublabel,
  className,
}) => {
  const sizeClasses = {
    sm: 'size-5',
    md: 'size-8',
    lg: 'size-12',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300',
        className
      )}
    >
      <div className="relative mb-3 flex items-center justify-center">
        <div className="absolute size-10 rounded-full bg-primary-100/60 animate-ping opacity-75" />
        <Loader2 className={cn('animate-spin text-primary-600', sizeClasses[size])} />
      </div>
      {label && (
        <span className="text-sm font-semibold text-ink tracking-tight">{label}</span>
      )}
      {sublabel && (
        <span className="text-xs text-muted mt-1 max-w-sm">{sublabel}</span>
      )}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="w-full bg-panel border border-line rounded-xl shadow-2xs overflow-hidden animate-pulse">
      {/* Table Header Skeleton */}
      <div className="bg-canvas/60 border-b border-line px-5 py-3.5 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 bg-slate-200 rounded-md"
            style={{ width: `${Math.max(12, 100 / columns - 2)}%` }}
          />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-line/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-5 py-4 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3.5 bg-slate-100 rounded-md"
                style={{
                  width: `${Math.max(15, (cIdx === 0 ? 30 : 100 / columns) - (rIdx % 3) * 3)}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-panel border border-line rounded-xl p-5 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 bg-slate-200 rounded-md w-1/3" />
            <div className="h-4 bg-slate-100 rounded-full w-16" />
          </div>
          <div className="h-8 bg-slate-200 rounded-md w-1/2" />
          <div className="space-y-2 pt-2 border-t border-line/60">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-panel border border-line rounded-xl p-5 shadow-2xs space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="size-8 rounded-lg bg-slate-100" />
            </div>
            <div className="h-7 bg-slate-200 rounded w-28" />
            <div className="h-2.5 bg-slate-100 rounded w-36" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-panel border border-line rounded-xl p-6 shadow-2xs h-80 flex flex-col justify-between">
          <div className="flex justify-between">
            <div className="h-4 bg-slate-200 rounded w-40" />
            <div className="h-4 bg-slate-100 rounded w-20" />
          </div>
          <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-muted">
            <Loader2 className="size-5 animate-spin text-primary-400 mr-2" />
            Loading analytical models...
          </div>
        </div>
        <div className="lg:col-span-4 bg-panel border border-line rounded-xl p-6 shadow-2xs h-80 flex flex-col justify-between">
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="size-44 mx-auto rounded-full border-8 border-slate-100 flex items-center justify-center">
            <span className="h-3 bg-slate-200 rounded w-16" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-full" />
        </div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  return (
    <div className="bg-panel border border-dashed border-line rounded-xl p-10 flex flex-col items-center justify-center text-center">
      {icon && <div className="text-muted mb-3">{icon}</div>}
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="text-xs text-muted max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
