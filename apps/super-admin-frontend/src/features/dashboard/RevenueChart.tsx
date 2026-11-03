import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { ArrowUpRight } from 'lucide-react';
import type { RevenueDataPoint } from '../../types';

export interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxMrr = Math.max(...data.map((d) => d.mrr), 160000);
  const minMrr = 60000;

  // Normalized points for SVG curve
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 520 + 40;
    const y = 175 - ((d.mrr - minMrr) / (maxMrr - minMrr)) * 135;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} 185 L ${points[0].x} 185 Z`;

  return (
    <Card className="lg:col-span-2 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">
              SaaS Revenue & Tenant Velocity
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
              <ArrowUpRight className="size-3" /> +14.8% MoM
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Verified Stripe subscription billing across 1,428 USA organizations.
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

      <div className="relative w-full h-56 pt-2 select-none">
        <svg viewBox="0 0 600 205" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2156e8" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#2156e8" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#2156e8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="40" y1="40" x2="560" y2="40" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="88" x2="560" y2="88" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="136" x2="560" y2="136" stroke="#f1f4f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="185" x2="560" y2="185" stroke="#e3e8f1" strokeWidth="1" />

          {/* Y Axis Labels */}
          <text x="32" y="44" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            $150k
          </text>
          <text x="32" y="92" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            $120k
          </text>
          <text x="32" y="140" fill="#98a2b6" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            $90k
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
        {hoveredIndex !== null && (
          <div
            className="absolute -top-3 bg-ink text-white px-3 py-1.5 rounded-[var(--radius-control)] shadow-pop text-xs font-mono pointer-events-none transform -translate-x-1/2 border border-ink-soft animate-in fade-in"
            style={{
              left: `${(hoveredIndex / (data.length - 1)) * 86 + 7}%`,
            }}
          >
            <div className="font-bold text-primary-300">{data[hoveredIndex].month} 2026</div>
            <div className="font-semibold text-white">MRR: ${(data[hoveredIndex].mrr).toLocaleString()}.00</div>
            <div className="text-[10px] text-faint">Tenants: {data[hoveredIndex].tenants} orgs</div>
          </div>
        )}
      </div>
    </Card>
  );
};
