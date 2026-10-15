import React, { useState } from 'react';
import { Calculator, ArrowRight, TrendingUp, DollarSign, Clock } from 'lucide-react';

interface RoiCalculatorProps {
  onStartTrial: () => void;
}

export const RoiCalculator: React.FC<RoiCalculatorProps> = ({ onStartTrial }) => {
  const [teamSize, setTeamSize] = useState<number>(15);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(6);

  // Calculations
  const hourlyRate = 95; // $95/hr standard engineering blended cost
  const monthlyHoursSaved = Math.round(teamSize * hoursPerWeek * 4.2 * 0.75); // 75% automation recovery
  const monthlyDollarSavings = Math.round(monthlyHoursSaved * hourlyRate);
  const estimatedCost = teamSize <= 5 ? 49 : teamSize <= 25 ? 149 : 499;
  const roiMultiplier = (monthlyDollarSavings / estimatedCost).toFixed(1);

  return (
    <section className="py-20 sm:py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Description & Sliders */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-mono border border-indigo-500/30">
                <Calculator className="w-3.5 h-3.5" />
                <span>Impact Assessment</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
                Calculate the operational hours and budget saved with NovaFlow
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                See real quantified returns based on your engineering team's size and weekly repetitive pipeline maintenance.
              </p>
            </div>

            {/* Slider 1: Team Size */}
            <div className="space-y-2 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-200">Engineers & Operations Team Size</span>
                <span className="text-indigo-400 font-bold font-mono text-base tabular-nums">
                  {teamSize} members
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="80"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>2 engineers</span>
                <span>40 engineers</span>
                <span>80+ enterprise</span>
              </div>
            </div>

            {/* Slider 2: Manual hours */}
            <div className="space-y-2 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-200">Hours Spent on Manual Ops / Week</span>
                <span className="text-indigo-400 font-bold font-mono text-base tabular-nums">
                  {hoursPerWeek} hrs / member
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>2 hrs (Light)</span>
                <span>8 hrs (Moderate)</span>
                <span>15 hrs (Heavy friction)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Results Card */}
          <div className="lg:col-span-5">
            <div className="p-7 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-800/90 to-slate-900 border border-indigo-500/40 shadow-2xl space-y-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Projected Monthly Value
              </span>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Monthly Cost Savings</span>
                    <p className="text-3xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                      ${monthlyDollarSavings.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-700/60">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Hours Reclaimed</span>
                    <p className="text-2xl font-bold text-white font-mono tabular-nums">
                      {monthlyHoursSaved.toLocaleString()} hrs / month
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-700/60">
                  <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Estimated ROI Multiplier</span>
                    <p className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                      {roiMultiplier}x Net Return
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onStartTrial}
                  className="w-full py-3.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Reclaim Engineering Hours Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-center text-slate-400 block mt-2.5">
                  14-day free access · Instant self-service setup
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
