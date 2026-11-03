import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MetricCardProps {
  title: string;
  value: string | number;
  changeText?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  changeText,
  changeType = 'neutral',
  subtext,
  icon,
  iconBgColor = 'bg-primary-50 text-primary-600 border border-primary-200/60',
}) => {
  return (
    <div className="bg-panel p-5 rounded-[var(--radius-card)] border border-line shadow-card hover:border-line-strong transition-all flex flex-col justify-between group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider font-mono">
          {title}
        </span>
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-2xs transition-transform group-hover:scale-105',
            iconBgColor
          )}
        >
          {icon}
        </div>
      </div>

      <div>
        <div className="text-2xl font-black text-ink tracking-tight mb-1.5">{value}</div>
        <div className="flex items-center gap-2 text-xs">
          {changeText && (
            <span
              className={cn(
                'font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[11px]',
                changeType === 'positive' && 'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
                changeType === 'negative' && 'bg-rose-50 text-rose-700 border border-rose-200/70',
                changeType === 'neutral' && 'bg-subtle text-ink-soft border border-line'
              )}
            >
              {changeType === 'positive' && <TrendingUp className="w-3 h-3 text-emerald-600" />}
              {changeType === 'negative' && <TrendingDown className="w-3 h-3 text-rose-600" />}
              {changeText}
            </span>
          )}
          {subtext && <span className="text-faint truncate text-[11px]">{subtext}</span>}
        </div>
      </div>
    </div>
  );
};
