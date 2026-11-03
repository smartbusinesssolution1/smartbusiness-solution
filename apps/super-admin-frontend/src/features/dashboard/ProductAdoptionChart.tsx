import React from 'react';
import { Card } from '../../components/common/Card';
import type { ProductAdoptionRatio } from '../../types';

export interface ProductAdoptionChartProps {
  products: ProductAdoptionRatio[];
}

export const ProductAdoptionChart: React.FC<ProductAdoptionChartProps> = ({ products }) => {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ink">Product Suite Adoption</h2>
          <span className="text-[11px] font-semibold text-muted font-mono">1,428 Active</span>
        </div>

        {/* Doughnut visualization via SVG */}
        <div className="flex items-center justify-center my-3 relative h-40">
          <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
            {/* Segment 1: Check Printing 54% */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="transparent"
              stroke="#2156e8"
              strokeWidth="13"
              strokeDasharray="54 46"
              strokeDashoffset="0"
              pathLength="100"
              className="transition-all hover:stroke-primary-700"
            />
            {/* Segment 2: Attendance 36% */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="transparent"
              stroke="#6366f1"
              strokeWidth="13"
              strokeDasharray="36 64"
              strokeDashoffset="-54"
              pathLength="100"
              className="transition-all hover:stroke-indigo-700"
            />
            {/* Segment 3: RAG Chatbot 10% */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="transparent"
              stroke="#a855f7"
              strokeWidth="13"
              strokeDasharray="10 90"
              strokeDashoffset="-90"
              pathLength="100"
              className="transition-all hover:stroke-purple-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-ink leading-tight">1,428</span>
            <span className="text-[10px] text-muted font-semibold uppercase tracking-wider font-mono">
              Organizations
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-line grid grid-cols-3 gap-2 text-center">
        {products.map((p) => (
          <div key={p.product} className="p-2 rounded-lg bg-subtle/70 border border-line">
            <div className="text-[10px] text-muted truncate font-medium">{p.product}</div>
            <div className="text-sm font-black text-ink">{p.percentage}%</div>
            <div className="text-[10px] text-primary-700 font-mono font-semibold">{p.activeCount} orgs</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
