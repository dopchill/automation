import { Cpu, Settings, Shield, Lock } from 'lucide-react';
import type { AutomationStatus } from '@/types';
import { useConfig } from './ConfigContext';

const statusConfig: Record<AutomationStatus, { label: string; dot: string; text: string; pulse: boolean }> = {
  idle: { label: 'SYSTEM READY', dot: 'bg-success-500', text: 'text-success-600', pulse: false },
  running: { label: 'AUTOMATION RUNNING', dot: 'bg-blue-500', text: 'text-blue-600', pulse: true },
  paused: { label: 'AUTOMATION PAUSED', dot: 'bg-warning-500', text: 'text-warning-600', pulse: false },
  stopped: { label: 'AUTOMATION STOPPED', dot: 'bg-navy-400', text: 'text-navy-600', pulse: false },
  completed: { label: 'AUTOMATION COMPLETE', dot: 'bg-success-500', text: 'text-success-600', pulse: false },
  error: { label: 'ACTION REQUIRED', dot: 'bg-danger-500', text: 'text-danger-600', pulse: true },
};

interface HeaderProps {
  status: AutomationStatus;
  onOpenSettings: () => void;
}

export function Header({ status, onOpenSettings }: HeaderProps) {
  const s = statusConfig[status];
  const { locked, status: configStatus } = useConfig();

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-white/95 backdrop-blur-xl border-b border-navy-100 shadow-sm relative z-20">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-pink-blue flex items-center justify-center shadow-glow-pink">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-navy-900 leading-none">
            CYBER<span className="text-gradient-pink-blue">X</span>
          </h1>
          <p className="text-[10px] text-navy-400 font-semibold tracking-wider uppercase mt-1">
            RMA Automation
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {/* Config lock badge */}
        {locked ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-900 text-white">
            <Lock className="w-3 h-3 text-pink-400" />
            <span className="text-[10px] font-bold tracking-wide">CONFIG LOCKED</span>
          </div>
        ) : configStatus === 'not-configured' ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning-50 border border-warning-200">
            <Settings className="w-3 h-3 text-warning-500" />
            <span className="text-[10px] font-bold tracking-wide text-warning-600">SETUP REQUIRED</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-50 border border-pink-200">
            <Settings className="w-3 h-3 text-pink-500" />
            <span className="text-[10px] font-bold tracking-wide text-pink-600">CONFIGURING</span>
          </div>
        )}

        {/* Auto-save safety badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-danger-50 border border-danger-200">
          <Shield className="w-3.5 h-3.5 text-danger-500" />
          <span className="text-[10px] font-bold text-danger-600 tracking-wide">AUTO-SAVE: OFF</span>
        </div>

        {/* System status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-50 border border-navy-100">
          <span className={`status-dot ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold tracking-wide ${s.text}`}>{s.label}</span>
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-500 hover:text-pink-500 hover:border-pink-200 hover:bg-pink-50 transition-all duration-300 active:scale-95"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
