import { Play, Pause, Square, StopCircle, ExternalLink, FileBarChart, Shield, CheckCircle2 } from 'lucide-react';
import type { AutomationStatus, PartySummary, RunSummary } from '@/types';

interface AutomationPanelProps {
  status: AutomationStatus;
  progress: number;
  currentParty: string;
  currentProduct: string;
  currentStep: string;
  parties: PartySummary[];
  runSummary: RunSummary | null;
  hasFile: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenBrowser: () => void;
  onViewReport: () => void;
}

const partyStatusConfig: Record<PartySummary['status'], { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'text-navy-300', label: 'PENDING' },
  processing: { icon: '●', color: 'text-pink-500', label: 'PROCESSING' },
  completed: { icon: '✓', color: 'text-success-500', label: 'COMPLETED' },
  skipped: { icon: '×', color: 'text-warning-500', label: 'SKIPPED' },
  error: { icon: '!', color: 'text-danger-500', label: 'ERROR' },
};

export function AutomationPanel({
  status,
  progress,
  currentParty,
  currentProduct,
  currentStep,
  parties,
  runSummary,
  hasFile,
  onStart,
  onPause,
  onResume,
  onStop,
  onOpenBrowser,
  onViewReport,
}: AutomationPanelProps) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const isStopped = status === 'stopped';

  // Completion screen
  if (isCompleted && runSummary) {
    return (
      <div className="card p-6 animate-bounce-subtle">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-success-500 flex items-center justify-center shadow-glow-success mb-3">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-lg font-bold text-navy-900">Automation Completed</h2>
          <p className="text-sm text-navy-400 mt-1 max-w-md">
            All possible entries have been prepared. Please review the browser tabs and manually click Save.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-navy-50 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-navy-900 tabular-nums">{runSummary.partyCount}</p>
            <p className="text-[10px] text-navy-400 font-medium mt-0.5">Parties</p>
          </div>
          <div className="bg-blue-50 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600 tabular-nums">{runSummary.productCount}</p>
            <p className="text-[10px] text-blue-400 font-medium mt-0.5">Products</p>
          </div>
          <div className="bg-success-50 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-success-600 tabular-nums">{runSummary.completed}</p>
            <p className="text-[10px] text-success-400 font-medium mt-0.5">Added</p>
          </div>
          <div className="bg-warning-50 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-warning-600 tabular-nums">{runSummary.skipped}</p>
            <p className="text-[10px] text-warning-400 font-medium mt-0.5">Skipped</p>
          </div>
          <div className="bg-pink-50 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-pink-600 tabular-nums">{runSummary.review}</p>
            <p className="text-[10px] text-pink-400 font-medium mt-0.5">Review</p>
          </div>
        </div>

        {/* Duration + Safety */}
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2 text-sm text-navy-500">
            <span>Duration:</span>
            <span className="font-bold text-navy-900 tabular-nums">{runSummary.duration}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-50 border border-danger-200">
            <Shield className="w-3.5 h-3.5 text-danger-500" />
            <span className="text-[11px] font-bold text-danger-600">FINAL SAVE — MANUAL ACTION REQUIRED</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-center">
          <button onClick={onOpenBrowser} className="btn-primary">
            <ExternalLink className="w-4 h-4" />
            Open Browser
          </button>
          <button onClick={onViewReport} className="btn-secondary">
            <FileBarChart className="w-4 h-4" />
            View Report
          </button>
        </div>
      </div>
    );
  }

  // Stopped state
  if (isStopped) {
    return (
      <div className="card p-6 text-center animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-warning-100 flex items-center justify-center mb-3 mx-auto">
          <StopCircle className="w-7 h-7 text-warning-500" />
        </div>
        <h2 className="text-lg font-bold text-navy-900 mb-1">Automation Stopped</h2>
        <p className="text-sm text-navy-400 mb-5">
          Browser tabs remain open for manual review. You can start again when ready.
        </p>
        <button
          onClick={onStart}
          disabled={!hasFile}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          Start Again
        </button>
      </div>
    );
  }

  // Idle state — show start button
  if (status === 'idle') {
    return (
      <div className="card p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-pink-blue flex items-center justify-center shadow-glow-pink mb-3 mx-auto animate-pulse-glow-pink">
          <Play className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold text-navy-900 mb-1">Ready to Start</h2>
        <p className="text-sm text-navy-400 mb-5 max-w-sm mx-auto">
          {hasFile
            ? 'Click below to begin processing. The automation will open Chrome and handle each party automatically.'
            : 'Upload a daily Excel file first, then start the automation process.'}
        </p>
        <button
          onClick={onStart}
          disabled={!hasFile}
          className="btn-primary text-base px-8 py-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Play className="w-5 h-5" />
          Start Automation
        </button>
      </div>
    );
  }

  // Running / Paused state — live dashboard
  return (
    <div className="card p-5 animate-fade-in">
      {/* Status header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isRunning ? 'bg-blue-500 animate-pulse' : 'bg-warning-500'}`} />
          <h2 className="text-sm font-bold text-navy-900">
            {isRunning ? 'AUTOMATION RUNNING' : 'AUTOMATION PAUSED'}
          </h2>
        </div>
        <span className="text-2xl font-bold text-gradient-pink-blue tabular-nums">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-navy-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-pink-blue rounded-full transition-all duration-500 ease-smooth progress-stripe animate-progress-stripe"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current info */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-pink-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-pink-400 font-bold tracking-wide uppercase mb-1">Current Party</p>
          <p className="text-sm font-semibold text-navy-900 truncate">{currentParty || '—'}</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-blue-400 font-bold tracking-wide uppercase mb-1">Current Product</p>
          <p className="text-sm font-semibold text-navy-900 truncate">{currentProduct || '—'}</p>
        </div>
        <div className="bg-navy-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-navy-400 font-bold tracking-wide uppercase mb-1">Current Action</p>
          <p className="text-sm font-semibold text-navy-900 truncate">{currentStep || '—'}</p>
        </div>
      </div>

      {/* Party queue */}
      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] text-navy-400 font-bold tracking-wide uppercase mb-2">Party Queue</p>
        {parties.map((party) => {
          const cfg = partyStatusConfig[party.status];
          return (
            <div
              key={party.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-navy-50/50 hover:bg-navy-50 transition-all duration-300"
            >
              <span className={`text-sm font-bold ${cfg.color} w-4 text-center`}>{cfg.icon}</span>
              <span className="text-sm font-medium text-navy-700 flex-1 truncate">{party.name}</span>
              {party.status === 'processing' && (
                <div className="w-16 h-1.5 bg-navy-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-pink-blue rounded-full transition-all duration-500"
                    style={{ width: `${party.progress}%` }}
                  />
                </div>
              )}
              <span className="text-xs text-navy-400 tabular-nums">
                {party.completed}/{party.productCount}
              </span>
              <span className={`text-[10px] font-bold ${cfg.color} w-20 text-right`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 pt-4 border-t border-navy-100">
        {isRunning && (
          <button onClick={onPause} className="btn-secondary flex-1">
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
        {isPaused && (
          <button onClick={onResume} className="btn-primary flex-1">
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        <button onClick={onStop} className="btn-danger flex-1">
          <Square className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  );
}
