import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from './ui';

export interface ShiftTimePickerProps {
  label: string;
  value?: string; // HH:mm format e.g. "09:00"
  onChange: (timeStr: string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

export const ShiftTimePicker: React.FC<ShiftTimePickerProps> = ({
  label,
  value = '09:00',
  onChange,
  error = false,
  helperText,
  disabled = false,
}) => {
  // Formats "14:30" to "02:30 PM"
  const formatted12h = useMemo(() => {
    if (!value || !value.includes(':')) return value || '--:--';
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return value;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${mStr || '00'} ${ampm}`;
  }, [value]);

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 transition-all duration-150',
        error
          ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400/20'
          : 'border-line bg-canvas hover:border-line-strong'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Clock className="size-3.5 text-primary-600" />
          <span>{label}</span>
        </label>
        <Badge variant="brand" className="font-mono text-[0.6875rem] font-bold">
          {formatted12h}
        </Badge>
      </div>

      <div className="relative">
        <input
          type="time"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-9 w-full rounded-lg border border-line bg-panel px-3 font-mono text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
            disabled && 'pointer-events-none opacity-60'
          )}
        />
      </div>

      {helperText && (
        <p
          className={cn(
            'mt-1.5 font-mono text-[0.6875rem] leading-tight',
            error ? 'text-rose-600 font-medium' : 'text-muted'
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default ShiftTimePicker;
