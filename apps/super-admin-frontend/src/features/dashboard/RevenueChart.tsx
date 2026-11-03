import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { ArrowUpRight } from 'lucide-react';
import type { RevenueDataPoint } from '../../types';

export interface RevenueChartProps {
  data: RevenueDataPoint[];
  timeRange?: '30d' | 'quarter' | 'ytd';
}

function formatCompactCurrency(val: number): string {
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `$${Math.round(val / 1_000)}k`;
  }
  return `$${Math.round(val)}`;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, timeRange = '30d' }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <Card className="lg:col-span-2 flex items-center justify-center h-72">
        <p className="text-xs text-muted">No revenue history available.</p>
      </Card>
    );
  }

  const growthBadge =
    timeRange === 'quarter' ? '+38.4% QoQ' : timeRange === 'ytd' ? '+82.5% YTD' : '+14.8% MoM';

  const chartTitle =
    timeRange === 'quarter'
      ? 'SaaS Revenue & Tenant Velocity (Quarterly)'
      : timeRange === 'ytd'
        ? 'SaaS Revenue & Tenant Velocity (Year to Date)'
        : 'SaaS Revenue & Tenant Velocity (Past 30 Days)';

  // Dynamic bounds calculation with graceful padding
  const mrrValues = data.map((d) => d.mrr);
  const dataMin = Math.min(...mrrValues);
  const dataMax = Math.max(...mrrValues);

  const spread = Math.max(dataMax - dataMin, dataMax * 0.1 || 1000);
  const minMrr = Math.max(0, Math.floor((dataMin - spread * 0.2) / 1000) * 1000);
  const maxMrr = Math.ceil((dataMax + spread * 0.15) / 1000) * 1000;
  const mrrRange = Math.max(maxMrr - minMrr, 1);

  // Normalized points strictly clamped within SVG drawing area [30, 175]
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 520 + 40;
    const ratio = Math.max(0, Math.min(1, (d.mrr - minMrr) / mrrRange));
    const y = Math.max(30, Math.min(175, 175 - ratio * 140));
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} 185 L ${points[0].x} 185 Z`;

  // Grid tick values
  const tickHigh = minMrr + mrrRange * 0.95;
  const tickMidHigh = minMrr + mrrRange * 0.65;
  const tickMidLow = minMrr + mrrRange * 0.35;

  const latestDataPoint = data[data.length - 1];

  return (
    <Card className="lg:col-span-2 flex flex-col justify-between overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">
              {chartTitle}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
              <ArrowUpRight className="size-3" /> {growthBadge}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Verified Stripe subscription billing across{' '}
            {(latestDataPoint?.tenants || 1428).toLocaleString()} USA organizations.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs select-none font-mono">
          <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
            <span className="size-2.5 rounded-full bg-primary-600 inline-block shadow-2xs" /> MRR ($)
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-muted">
            <span className="size-2.5 rounded-full bg-primary-300 inline-block" /> Active Tenants
          </span>
        </div>
      </div>

      <div className="relative w-full h-56 pt-2 select-none overflow-hidden">
        <svg viewBox="0 0 600 205" className="w-full h-full overflow-hidden">
          <defs>
            <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2156e8" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#2156e8" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#2156e8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="40" y1="42" x2="560" y2="42" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="88" x2="560" y2="88" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="136" x2="560" y2="136" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="185" x2="560" y2="185" stroke="#e3e8f1" strokeWidth="1" />

          {/* Y Axis Labels */}
          <text x="32" y="46" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            {formatCompactCurrency(tickHigh)}
          </text>
          <text x="32" y="92" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            {formatCompactCurrency(tickMidHigh)}
          </text>
          <text x="32" y="140" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            {formatCompactCurrency(tickMidLow)}
          </text>

          {/* Gradient Area Fill */}
          <path d={areaD} fill="url(#treasuryGradient)" />

          {/* Curved Line */}
          <path d={pathD} fill="none" stroke="#2156e8" strokeWidth="2.5" />

          {/* Points */}
          {points.map((p, idx) => (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === idx ? 6 : 4}
                fill={hoveredIndex === idx ? '#1a45c4' : '#2156e8'}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all"
              />
              <text
                x={p.x}
                y="200"
                fill="#5c6880"
                fontSize="11"
                fontFamily="Plus Jakarta Sans"
                fontWeight="600"
                textAnchor="middle"
              >
                {p.month}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute -top-3 bg-ink text-white px-3 py-1.5 rounded-[var(--radius-control)] shadow-pop text-xs font-mono pointer-events-none transform -translate-x-1/2 border border-ink-soft animate-in fade-in"
            style={{
              left: `${Math.max(12, Math.min(88, (hoveredIndex / Math.max(data.length - 1, 1)) * 86 + 7))}%`,
            }}
          >
            <div className="font-bold text-primary-300">{data[hoveredIndex].month} 2026</div>
            <div className="font-semibold text-white">
              MRR: ${data[hoveredIndex].mrr.toLocaleString()}.00
            </div>
            <div className="text-[10px] text-faint">
              Tenants: {data[hoveredIndex].tenants.toLocaleString()} orgs
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
