import React, { useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Check, ArrowRight } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial: () => void;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, onStartTrial }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(38); // 38%
  const [activeChapter, setActiveChapter] = useState(1);

  if (!isOpen) return null;

  const chapters = [
    { id: 0, title: '01. Ingestion Triggers', timestamp: '0:00' },
    { id: 1, title: '02. AI Reasoning Nodes', timestamp: '0:45' },
    { id: 2, title: '03. Multi-Dest Execution', timestamp: '1:20' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
            <h3 className="text-sm font-semibold text-white">NovaFlow Product Walkthrough (2:10)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas Simulation */}
        <div className="relative aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          {/* Animated decorative grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

          {/* Central simulated walkthrough content */}
          <div className="relative z-10 max-w-lg space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono">
              <span>Chapter {activeChapter + 1} of 3: {chapters[activeChapter].title}</span>
            </div>

            <h4 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Autonomous Triage with Real-Time Telemetry
            </h4>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Watch how incoming payloads are decrypted, analyzed by LLM agents, and dispatched to down-stream destinations in under 25 milliseconds.
            </p>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Simulated Bottom Controls Bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 z-20 space-y-2">
            {/* Progress bar */}
            <div
              className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const newProgress = Math.round((clickX / rect.width) * 100);
                setProgress(newProgress);
              }}
            >
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-[11px] tabular-nums">0:52 / 2:10</span>
                </div>
              </div>

              {/* Chapters selector */}
              <div className="hidden sm:flex items-center gap-2">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setActiveChapter(ch.id);
                      setProgress(ch.id === 0 ? 10 : ch.id === 1 ? 45 : 80);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      activeChapter === ch.id
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Call to Action */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Ready to test this in your own development environment?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onStartTrial();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Start 14-Day Trial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
