import type { DurationUnit } from '../types';

export function formatDuration(count: number, unit: DurationUnit): string {
  const normalizedUnit = unit.toUpperCase() as DurationUnit;

  if (normalizedUnit === 'MONTH') {
    if (count === 1) return 'Monthly (1 Month)';
    if (count === 3) return '3 Months (Quarterly)';
    if (count === 6) return '6 Months (Bi-Annual)';
    if (count === 12) return '12 Months (1 Year)';
    return `${count} Months`;
  }

  if (normalizedUnit === 'YEAR') {
    if (count === 1) return 'Yearly (1 Year)';
    return `${count} Years`;
  }

  if (normalizedUnit === 'DAY') {
    if (count === 1) return '1 Day';
    return `${count} Days`;
  }

  return `${count} ${unit.toLowerCase()}`;
}

export function formatDurationShort(count: number, unit: DurationUnit): string {
  const normalizedUnit = unit.toUpperCase() as DurationUnit;

  if (normalizedUnit === 'MONTH') {
    if (count === 1) return 'mo';
    return `${count} mos`;
  }

  if (normalizedUnit === 'YEAR') {
    if (count === 1) return 'yr';
    return `${count} yrs`;
  }

  if (normalizedUnit === 'DAY') {
    if (count === 1) return 'day';
    return `${count} days`;
  }

  return `${count} ${unit.toLowerCase()}`;
}
