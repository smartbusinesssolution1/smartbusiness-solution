import React from 'react';
import { COMPARISON_FEATURES } from '../../data/mockData';
import { Check, Minus } from 'lucide-react';

export const FeatureComparisonTable: React.FC = () => {
  return (
    <div className="mt-20 pt-16 border-t border-slate-200">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Comprehensive Feature Matrix
        </h3>
        <p className="text-sm text-slate-600 mt-2">
          Compare limits, capabilities, and governance policies across every plan tier.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700">
              <th className="py-4 px-6 font-bold text-slate-900 w-2/5">Platform Features</th>
              <th className="py-4 px-6 text-center w-1/5">Starter</th>
              <th className="py-4 px-6 text-center w-1/5 bg-indigo-50/40 text-indigo-950 font-bold border-x border-indigo-100">
                Professional
              </th>
              <th className="py-4 px-6 text-center w-1/5">Enterprise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {COMPARISON_FEATURES.map((category) => (
              <React.Fragment key={category.category}>
                <tr className="bg-slate-100/70">
                  <td colSpan={4} className="py-2.5 px-6 font-bold text-xs uppercase tracking-wider text-slate-700">
                    {category.category}
                  </td>
                </tr>
                {category.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6 text-slate-800 font-medium">{item.name}</td>
                    <td className="py-3.5 px-6 text-center text-slate-600">
                      {typeof item.starter === 'boolean' ? (
                        item.starter ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-xs font-mono">{item.starter}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-center bg-indigo-50/20 text-indigo-950 font-semibold border-x border-indigo-100/60">
                      {typeof item.pro === 'boolean' ? (
                        item.pro ? (
                          <Check className="w-4 h-4 text-indigo-600 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-xs font-mono">{item.pro}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-center text-slate-800 font-medium">
                      {typeof item.enterprise === 'boolean' ? (
                        item.enterprise ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-xs font-mono">{item.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
